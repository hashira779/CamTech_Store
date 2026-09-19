import os
import io
import asyncio
import hashlib
import tempfile
from typing import Optional, Tuple, AsyncGenerator
import aiofiles
from PIL import Image

CACHE_DIR = os.path.join(tempfile.gettempdir(), "camtech_storage_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def get_cache_key(object_key: str, width: Optional[int] = None, height: Optional[int] = None) -> str:
    key_str = f"{object_key}_{width}_{height}"
    return hashlib.md5(key_str.encode('utf-8')).hexdigest()

async def get_cached_file(object_key: str, width: Optional[int] = None, height: Optional[int] = None) -> Optional[str]:
    cache_key = get_cache_key(object_key, width, height)
    file_path = os.path.join(CACHE_DIR, cache_key)
    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        return file_path
    return None

async def save_to_cache(object_key: str, byte_data: bytes, width: Optional[int] = None, height: Optional[int] = None) -> str:
    cache_key = get_cache_key(object_key, width, height)
    file_path = os.path.join(CACHE_DIR, cache_key)
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(byte_data)
    return file_path

async def generate_thumbnail(original_bytes: bytes, width: int, height: int) -> bytes:
    def _resize():
        with Image.open(io.BytesIO(original_bytes)) as img:
            img.thumbnail((width, height), Image.LANCZOS)
            out_io = io.BytesIO()
            # For small thumbnails (≤200px), always use JPEG for speed
            if width <= 200 and height <= 200:
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                img.save(out_io, format='JPEG', quality=75, optimize=True)
            else:
                fmt = img.format if img.format in ['JPEG', 'PNG', 'WEBP', 'GIF'] else 'PNG'
                if fmt == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                img.save(out_io, format=fmt, quality=85)
            return out_io.getvalue()
    
    return await asyncio.to_thread(_resize)

def validate_and_inspect_image(image_bytes: bytes) -> dict:
    """Validates that bytes form a legitimate image and returns basic metadata."""
    if not image_bytes or len(image_bytes) < 16:
        raise ValueError("Image payload is empty or too small to be valid")
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
        with Image.open(io.BytesIO(image_bytes)) as img:
            return {
                "width": img.width,
                "height": img.height,
                "format": img.format or "UNKNOWN",
                "mode": img.mode,
            }
    except Exception as exc:
        raise ValueError(f"Invalid or corrupted image: {exc}") from exc

def _generate_variants_sync(original_bytes: bytes) -> dict:
    """Synchronous core for generating WebP variants while preserving aspect ratio."""
    with Image.open(io.BytesIO(original_bytes)) as img:
        orig_w, orig_h = img.size
        orig_fmt = img.format or "JPEG"
        orig_mode = img.mode

        # Check transparency
        has_transparency = (
            orig_mode in ("RGBA", "LA")
            or (orig_mode == "P" and "transparency" in img.info)
        )

        def _render_variant(max_w: int, max_h: int, quality: int) -> bytes:
            variant_img = img.copy()
            variant_img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)
            if has_transparency:
                if variant_img.mode != "RGBA":
                    variant_img = variant_img.convert("RGBA")
            else:
                if variant_img.mode in ("RGBA", "LA", "P", "CMYK"):
                    variant_img = variant_img.convert("RGB")

            out = io.BytesIO()
            variant_img.save(out, format="WEBP", quality=quality, method=6)
            return out.getvalue()

        thumb_data = _render_variant(200, 200, quality=80)
        medium_data = _render_variant(600, 600, quality=85)
        large_data = _render_variant(1200, 1200, quality=90)

        return {
            "width": orig_w,
            "height": orig_h,
            "format": orig_fmt,
            "mime_type": "image/webp",
            "variants": {
                "thumbnail": thumb_data,
                "medium": medium_data,
                "large": large_data,
            }
        }

async def generate_image_variants(original_bytes: bytes) -> dict:
    """
    Asynchronously generates WebP image variants (thumbnail ~200x200, medium ~600x600, large ~1200x1200)
    in a background thread pool, preserving aspect ratio and transparency.
    """
    return await asyncio.to_thread(_generate_variants_sync, original_bytes)

async def process_and_cache_image(
    object_key: str, 
    stream_generator: AsyncGenerator[bytes, None], 
    width: Optional[int] = None, 
    height: Optional[int] = None
) -> str:
    """
    Consumes the stream generator, caches the original (if needed) and generates a thumbnail.
    Returns the path to the cached file (original or thumbnail).
    """
    # Read entire stream into memory (could be large, but for images it's usually acceptable)
    chunks = []
    async for chunk in stream_generator:
        chunks.append(chunk)
    
    original_bytes = b"".join(chunks)
    
    # Save original to cache if we want
    await save_to_cache(object_key, original_bytes)
    
    if width and height:
        try:
            thumbnail_bytes = await generate_thumbnail(original_bytes, width, height)
            return await save_to_cache(object_key, thumbnail_bytes, width, height)
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            # Fallback to original
            return await get_cached_file(object_key)
            
    return await get_cached_file(object_key)

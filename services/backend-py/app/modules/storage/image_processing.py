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
            img.thumbnail((width, height))
            out_io = io.BytesIO()
            fmt = img.format if img.format in ['JPEG', 'PNG', 'WEBP', 'GIF'] else 'PNG'
            if fmt == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            img.save(out_io, format=fmt)
            return out_io.getvalue()
    
    return await asyncio.to_thread(_resize)

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

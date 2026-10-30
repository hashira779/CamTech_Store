import os
from PIL import Image, ImageDraw

svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#4f46e5"/>
  <path d="M9 11h14l-1.5 12h-11L9 11z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <path d="M12 11V8a4 4 0 0 1 8 0v3" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="17" r="2" fill="#38bdf8"/>
</svg>'''

def create_ico(output_path):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Rounded rect background in indigo #4f46e5
    draw.rounded_rectangle([2, 2, 62, 62], radius=16, fill=(79, 70, 229, 255))
    
    # Shopping bag handle white #ffffff
    draw.arc([22, 10, 42, 30], start=180, end=0, fill=(255, 255, 255, 255), width=4)
    # Shopping bag body white #ffffff
    draw.polygon([(16, 22), (48, 22), (44, 50), (20, 50)], outline=(255, 255, 255, 255), width=4)
    # Inner dot cyan #38bdf8
    draw.ellipse([28, 32, 36, 40], fill=(56, 189, 248, 255))
    
    img.save(output_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

target_dirs = [
    "apps/web/public",
    "apps/store/public",
    "apps/cashier/public",
    "apps/ceo/public",
    "apps/delivery/public",
    "apps/hr/public",
]

for d in target_dirs:
    os.makedirs(d, exist_ok=True)
    ico_path = os.path.join(d, "favicon.ico")
    svg_path = os.path.join(d, "vite.svg")
    fav_svg_path = os.path.join(d, "favicon.svg")
    create_ico(ico_path)
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    with open(fav_svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Generated icons in {d}")

print("Done!")

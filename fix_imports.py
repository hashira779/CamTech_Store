import os

files_to_fix = [
    r'services\backend-py\app\modules\catalog\helpers.py',
    r'services\backend-py\app\modules\catalog\routers\products.py',
    r'services\backend-py\app\modules\catalog\routers\product_images.py',
    r'services\backend-py\app\modules\catalog\routers\categories.py'
]

for fp in files_to_fix:
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('from .models import ', 'from app.modules.catalog.models import ')
    content = content.replace('from .schemas import ', 'from app.modules.catalog.schemas import ')
    
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)

print("Imports fixed.")

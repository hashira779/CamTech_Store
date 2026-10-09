import os
import re

file_path = r'services\backend-py\app\modules\catalog\api.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

parts = re.split(r'# ==============================================================================\n# (PRODUCTS|PRODUCT IMAGES|CATEGORIES — Helpers|CATEGORIES — Endpoints)\n# ==============================================================================\n', content)

header = parts[0]
products = parts[2]
images = parts[4]
cat_helpers = parts[6]
cat_endpoints = parts[8]

routers_dir = r'services\backend-py\app\modules\catalog\routers'
os.makedirs(routers_dir, exist_ok=True)
with open(os.path.join(routers_dir, '__init__.py'), 'w', encoding='utf-8') as f:
    f.write('')

# The header has imports. We need to duplicate the imports for the new files.
# Let's extract the imports from the header.
imports = re.match(r'^(.*?)\n\ndef ', header, re.DOTALL)
imports_str = imports.group(1) if imports else header

# Write helpers.py
with open(r'services\backend-py\app\modules\catalog\helpers.py', 'w', encoding='utf-8') as f:
    f.write(imports_str + "\n\n")
    # Write the product helpers (everything in header after imports)
    prod_helpers = header[len(imports_str):].replace('router = APIRouter(tags=["Catalog"])', '').strip()
    f.write(prod_helpers + "\n\n")
    f.write(cat_helpers)

# Write routers/products.py
with open(os.path.join(routers_dir, 'products.py'), 'w', encoding='utf-8') as f:
    f.write(imports_str + "\n")
    f.write("from app.modules.catalog.helpers import to_product_dto\n\n")
    f.write("router = APIRouter(tags=['Catalog - Products'])\n\n")
    f.write(products)

# Write routers/product_images.py
with open(os.path.join(routers_dir, 'product_images.py'), 'w', encoding='utf-8') as f:
    f.write(imports_str + "\n")
    f.write("from app.modules.catalog.helpers import to_product_dto\n\n")
    f.write("router = APIRouter(tags=['Catalog - Images'])\n\n")
    f.write(images)

# Write routers/categories.py
with open(os.path.join(routers_dir, 'categories.py'), 'w', encoding='utf-8') as f:
    f.write(imports_str + "\n")
    f.write("from app.modules.catalog.helpers import _to_category_dto, _compute_level, _get_product_counts\n\n")
    f.write("router = APIRouter(tags=['Catalog - Categories'])\n\n")
    f.write(cat_endpoints)

# Rewrite api.py
with open(file_path, 'w', encoding='utf-8') as f:
    f.write('''from fastapi import APIRouter
from .routers.products import router as products_router
from .routers.product_images import router as images_router
from .routers.categories import router as categories_router

router = APIRouter()
router.include_router(products_router)
router.include_router(images_router)
router.include_router(categories_router)
''')

print("Split completed.")

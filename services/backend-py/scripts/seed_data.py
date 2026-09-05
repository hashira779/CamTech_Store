import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def seed():
    print("🚀 Seeding Enterprise Database with Rich Live Data (2026–2030 Standard)...")
    async with AsyncSessionLocal() as db:
        # Get existing org and branch
        org_row = (await db.execute(text("SELECT id FROM organizations LIMIT 1;"))).fetchone()
        org_id = org_row[0] if org_row else "cmtk8h18o0000vkd0etmdacgw"

        branch_row = (await db.execute(text("SELECT id FROM locations WHERE type = 'BRANCH' LIMIT 1;"))).fetchone()
        branch_id = branch_row[0] if branch_row else None

        user_row = (await db.execute(text("SELECT id FROM users LIMIT 1;"))).fetchone()
        user_id = user_row[0] if user_row else None

        # 1. Categories
        categories = [
            ("cat-tech", org_id, "Tech & Electronics", "Laptops, Audio, Fast Chargers"),
            ("cat-cafe", org_id, "Specialty Coffee", "Artisan espresso, single origin brews"),
            ("cat-bakery", org_id, "Fresh Bakery", "Croissants, sandwiches, pastries"),
            ("cat-apparel", org_id, "Apparel & Fashion", "Techwear and casual athletics"),
        ]
        for cid, oid, name, desc in categories:
            await db.execute(text("""
                INSERT INTO categories (id, "organizationId", name, description, "createdAt", "updatedAt")
                VALUES (:id, :oid, :name, :desc, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """), {"id": cid, "oid": oid, "name": name, "desc": desc})

        # 2. Brands
        brands = [
            ("brand-apple", org_id, "Apple"),
            ("brand-mystore", org_id, "CamTech Signature"),
            ("brand-nike", org_id, "Nike Athletics"),
        ]
        for bid, oid, name in brands:
            await db.execute(text("""
                INSERT INTO brands (id, "organizationId", name, "createdAt", "updatedAt")
                VALUES (:id, :oid, :name, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """), {"id": bid, "oid": oid, "name": name})

        # 3. Products, Variants & Inventory
        products = [
            ("prod-mbp14", org_id, "cat-tech", "brand-apple", "MacBook Pro 14 M3", "Next-gen Apple Silicon for creative pros.", [
                ("var-mbp14-512", "MBP-14-512", "14-inch Space Gray (512GB / 18GB RAM)", 1650.00, 1999.00, 45),
                ("var-mbp14-1tb", "MBP-14-1TB", "14-inch Silver (1TB / 36GB RAM)", 2100.00, 2499.00, 25),
            ]),
            ("prod-airpods", org_id, "cat-tech", "brand-apple", "AirPods Pro 2 (USB-C)", "Active Noise Cancellation with Adaptive Audio.", [
                ("var-app2", "APP-PRO-2", "AirPods Pro 2nd Gen", 180.00, 249.00, 120),
            ]),
            ("prod-charger", org_id, "cat-tech", "brand-mystore", "65W GaN Dual Fast Charger", "High speed fast charging for laptops & phones.", [
                ("var-gan-65", "CHG-GAN-65", "65W GaN Dual Port Black", 20.00, 39.99, 200),
            ]),
            ("prod-espresso", org_id, "cat-cafe", "brand-mystore", "Artisan Espresso Double Shot", "Locally sourced Mondulkiri Arabica beans.", [
                ("var-esp-dbl", "COF-ESP-DBL", "Double Shot Espresso", 0.80, 2.90, 500),
            ]),
            ("prod-latte", org_id, "cat-cafe", "brand-mystore", "Iced Spanish Caramel Latte", "Rich espresso with fresh milk and condensed caramel.", [
                ("var-lat-16", "COF-LAT-16", "Regular 16oz Cup", 1.10, 3.50, 400),
                ("var-lat-22", "COF-LAT-22", "Large 22oz Cup", 1.40, 4.20, 350),
            ]),
            ("prod-croissant", org_id, "cat-bakery", "brand-mystore", "French Butter Croissant", "Freshly baked daily with 100% Normandy butter.", [
                ("var-crs-but", "BAK-CRS-BUT", "Classic Butter Croissant", 0.90, 2.80, 80),
                ("var-crs-choc", "BAK-CRS-CHO", "Pain au Chocolat", 1.20, 3.20, 60),
            ]),
            ("prod-hoodie", org_id, "cat-apparel", "brand-nike", "Tech Fleece Zip Hoodie", "Premium lightweight warmth with tailored fit.", [
                ("var-nk-hd-m", "NK-HD-BLK-M", "Black / Medium", 60.00, 110.00, 35),
            ]),
        ]

        for pid, oid, cid, bid, name, desc, variants in products:
            await db.execute(text("""
                INSERT INTO products (id, "organizationId", "categoryId", "brandId", type, name, description, "isActive", "createdAt", "updatedAt")
                VALUES (:id, :oid, :cid, :bid, 'PHYSICAL'::"ProductType", :name, :desc, true, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;
            """), {"id": pid, "oid": oid, "cid": cid, "bid": bid, "name": name, "desc": desc})

            for vid, sku, vname, cost, sell, stock in variants:
                await db.execute(text("""
                    INSERT INTO product_variants (id, "organizationId", "productId", sku, barcode, name, unit, currency, "costPrice", "sellPrice", "taxRatePct", "isActive", "createdAt", "updatedAt")
                    SELECT :id, :oid, :pid, :sku, :barcode, :name, 'piece', 'USD', :cost, :sell, 10.00, true, NOW(), NOW()
                    WHERE NOT EXISTS (
                        SELECT 1 FROM product_variants WHERE "organizationId" = :oid AND (id = :id OR sku = :sku)
                    );
                """), {
                    "id": vid, "oid": oid, "pid": pid, "sku": sku,
                    "barcode": f"885{vid[-6:]}", "name": vname,
                    "cost": cost, "sell": sell
                })

                actual_vid_row = (await db.execute(text('SELECT id FROM product_variants WHERE sku = :sku'), {"sku": sku})).fetchone()
                if actual_vid_row and branch_id:
                    actual_vid = actual_vid_row[0]
                    await db.execute(text("""
                        INSERT INTO inventory_items (id, "organizationId", "locationId", "productVariantId", "stockOnHand", "reorderPoint", "updatedAt")
                        VALUES (:id, :oid, :lid, :vid, :stock, 15, NOW())
                        ON CONFLICT (id) DO UPDATE SET "stockOnHand" = EXCLUDED."stockOnHand";
                    """), {"id": f"inv-{actual_vid}", "oid": oid, "lid": branch_id, "vid": actual_vid, "stock": stock})

        # 4. Customers with Loyalty Tiers
        customers = [
            ("cust-01", org_id, "Sokha Chem", "sokha.chem@gmail.com", "+855 12 889 900", "PLATINUM", 2450),
            ("cust-02", org_id, "David Miller", "david.m@outlook.com", "+855 98 112 233", "GOLD", 1200),
            ("cust-03", org_id, "Lisa Wang", "lisa.wang@techcorp.io", "+855 77 445 566", "SILVER", 650),
            ("cust-04", org_id, "Vicheka Pov", "vicheka.pov@cambodia.com", "+855 10 990 011", "BRONZE", 150),
        ]
        for cid, oid, name, email, phone, tier, pts in customers:
            await db.execute(text("""
                INSERT INTO customers (id, "organizationId", name, email, phone, type, "loyaltyTier", "loyaltyPoints", "createdAt", "updatedAt")
                SELECT :id, :oid, :name, :email, :phone, 'INDIVIDUAL'::"CustomerType", :tier, :pts, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM customers WHERE "organizationId" = :oid AND (id = :id OR email = :email)
                );
            """), {"id": cid, "oid": oid, "name": name, "email": email, "phone": phone, "tier": tier, "pts": pts})

        # 5. HR Departments & Employees
        depts = [
            ("dept-eng", org_id, "Engineering & IT", "IT-ENG"),
            ("dept-retail", org_id, "Retail & Operations", "RET-OPS"),
            ("dept-fin", org_id, "Finance & Accounting", "FIN-ACC"),
            ("dept-log", org_id, "Supply Chain & Fleet", "LOG-SCM"),
        ]
        for did, oid, name, code in depts:
            await db.execute(text("""
                INSERT INTO departments (id, "organizationId", name, code, "createdAt", "updatedAt")
                SELECT :id, :oid, :name, :code, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM departments WHERE "organizationId" = :oid AND (id = :id OR code = :code)
                );
            """), {"id": did, "oid": oid, "name": name, "code": code})

        employees = [
            ("emp-01", org_id, "dept-eng", "Kosal", "Vann", "kosal.v@camtech.cam", "Principal Software Architect", 4500.00, "FULL_TIME"),
            ("emp-02", org_id, "dept-retail", "Sophea", "Noun", "sophea.n@camtech.cam", "Retail Operations Lead", 2200.00, "FULL_TIME"),
            ("emp-03", org_id, "dept-fin", "Rathana", "Lim", "rathana.l@camtech.cam", "Senior Financial Controller", 2800.00, "FULL_TIME"),
            ("emp-04", org_id, "dept-log", "Meng", "Chhay", "meng.c@camtech.cam", "Fleet Logistics Coordinator", 1800.00, "FULL_TIME"),
        ]
        for eid, oid, did, fn, ln, email, pos, salary, stat in employees:
            await db.execute(text("""
                INSERT INTO employees (id, "organizationId", "departmentId", "firstName", "lastName", email, position, "baseSalary", status, "createdAt", "updatedAt")
                SELECT :id, :oid, :did, :fn, :ln, :email, :pos, :sal, CAST(:stat AS "EmploymentStatus"), NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM employees WHERE "organizationId" = :oid AND (id = :id OR email = :email)
                );
            """), {"id": eid, "oid": oid, "did": did, "fn": fn, "ln": ln, "email": email, "pos": pos, "sal": salary, "stat": stat})

        # 6. Sales History for Live Revenue Charts
        if branch_id and user_id:
            now = datetime.utcnow()
            for i in range(1, 15):
                sale_id = f"sale-live-{i:03d}"
                sale_num = f"POS-2026-{1000 + i}"
                subtotal = Decimal(str(60.00 + (i * 28.50)))
                tax = subtotal * Decimal("0.10")
                total = subtotal + tax
                sale_time = now - timedelta(days=(14 - i) // 2, hours=(i % 7) * 3)

                await db.execute(text("""
                    INSERT INTO sales (id, "organizationId", "locationId", "userId", "customerId", "saleNumber", subtotal, "taxTotal", "discountTotal", "grandTotal", status, "createdAt", "updatedAt")
                    VALUES (:id, :oid, :lid, :uid, :cid, :num, :sub, :tax, 0.00, :total, 'COMPLETED'::"SaleStatus", :time, :time)
                    ON CONFLICT (id) DO NOTHING;
                """), {
                    "id": sale_id, "oid": org_id, "lid": branch_id, "uid": user_id,
                    "cid": "cust-01" if i % 2 == 0 else "cust-02",
                    "num": sale_num, "sub": subtotal, "tax": tax, "total": total, "time": sale_time
                })

                await db.execute(text("""
                    INSERT INTO sale_payments (id, "saleId", method, amount, status, "paidAt")
                    VALUES (:id, :sid, 'CASH'::"PaymentMethod", :amt, 'COMPLETED'::"PaymentStatus", :time)
                    ON CONFLICT (id) DO NOTHING;
                """), {
                    "id": f"pay-{sale_id}", "sid": sale_id, "amt": total, "time": sale_time
                })

        await db.commit()
        print("✅ SUCCESS: Enterprise database populated with rich products, inventory, staff, customers, and live sales history!")

if __name__ == "__main__":
    asyncio.run(seed())

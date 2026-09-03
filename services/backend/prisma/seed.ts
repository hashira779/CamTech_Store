import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Wipe all existing records in dependency order for a clean start
  await prisma.salePayment.deleteMany();
  await prisma.saleLineItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.auditLog.deleteMany();

  const org = await prisma.organization.upsert({
    where: { slug: 'enterprise-group' },
    update: {},
    create: { name: 'Global Enterprise Group', slug: 'enterprise-group' },
  });

  const retailCo = await prisma.location.create({
    data: {
      organizationId: org.id,
      type: 'COMPANY',
      name: 'Retail Division',
      code: 'CO-RETAIL',
    },
  });

  const fbCo = await prisma.location.create({
    data: {
      organizationId: org.id,
      type: 'COMPANY',
      name: 'F&B Division',
      code: 'CO-FB',
    },
  });

  const downtownBranch = await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: retailCo.id,
      type: 'BRANCH',
      name: 'Downtown Supermarket',
      code: 'BR-DOWNTOWN',
    },
  });

  const centralCafe = await prisma.location.create({
    data: {
      organizationId: org.id,
      parentId: fbCo.id,
      type: 'BRANCH',
      name: 'Central Cafe',
      code: 'BR-CENTRAL',
    },
  });

  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const cashierPassword = await bcrypt.hash('Cashier123!', 10);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@demo.test',
      name: 'Enterprise Admin',
      passwordHash: adminPassword,
      roles: JSON.stringify(['ORG_ADMIN']),
    },
  });

  const cashierUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      locationId: centralCafe.id,
      email: 'cashier@demo.test',
      name: 'Cafe Cashier',
      passwordHash: cashierPassword,
      roles: JSON.stringify(['CASHIER']),
    },
  });

  // Seed Categories
  const catCoffee = await prisma.category.create({
    data: { organizationId: org.id, name: 'Coffee', description: 'Freshly brewed coffee' },
  });

  const catApparel = await prisma.category.create({
    data: { organizationId: org.id, name: 'Apparel', description: 'Clothing and Fashion' },
  });

  // Seed Brands
  const brandMyStore = await prisma.brand.create({
    data: { organizationId: org.id, name: 'MyStore Signature' },
  });

  const brandNike = await prisma.brand.create({
    data: { organizationId: org.id, name: 'Nike' },
  });

  // Seed Products: Coffee with variants
  const espressoProduct = await prisma.product.create({
    data: {
      organizationId: org.id,
      categoryId: catCoffee.id,
      brandId: brandMyStore.id,
      type: 'PHYSICAL',
      name: 'Artisan Espresso',
      description: 'Single-origin espresso shot',
      variants: {
        create: [
          {
            organizationId: org.id,
            sku: 'COF-ESP-SGL',
            name: 'Single Shot',
            costPrice: 0.5,
            sellPrice: 2.5,
            taxRatePct: 10,
          },
          {
            organizationId: org.id,
            sku: 'COF-ESP-DBL',
            name: 'Double Shot',
            costPrice: 0.7,
            sellPrice: 3.5,
            taxRatePct: 10,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Seed Products: Apparel with variants
  const tshirtProduct = await prisma.product.create({
    data: {
      organizationId: org.id,
      categoryId: catApparel.id,
      brandId: brandNike.id,
      type: 'PHYSICAL',
      name: 'Classic T-Shirt',
      description: '100% Cotton classic fit t-shirt',
      variants: {
        create: [
          {
            organizationId: org.id,
            sku: 'TSHIRT-BLK-M',
            name: 'Medium / Black',
            barcode: '100000001001',
            costPrice: 8.0,
            sellPrice: 25.0,
            taxRatePct: 5,
          },
          {
            organizationId: org.id,
            sku: 'TSHIRT-BLK-L',
            name: 'Large / Black',
            barcode: '100000001002',
            costPrice: 8.5,
            sellPrice: 25.0,
            taxRatePct: 5,
          },
          {
            organizationId: org.id,
            sku: 'TSHIRT-WHT-M',
            name: 'Medium / White',
            barcode: '100000001003',
            costPrice: 7.5,
            sellPrice: 25.0,
            taxRatePct: 5,
          },
        ],
      },
    },
    include: { variants: true },
  });

  // Seed Customers
  const customer1 = await prisma.customer.create({
    data: {
      organizationId: org.id,
      code: 'C-0001',
      name: 'Sokha Chan',
      email: 'sokha@example.com',
      phone: '+85512345678',
      type: 'INDIVIDUAL',
      notes: 'Regular morning coffee customer',
      isActive: true,
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      organizationId: org.id,
      code: 'C-0002',
      name: 'Angkor Retail Distribution Co.',
      email: 'procurement@angkorretail.com',
      phone: '+85523998877',
      taxId: 'VAT-KH-2024-88392',
      type: 'COMPANY',
      notes: 'Bulk corporate buyer with 30-day payment terms',
      isActive: true,
    },
  });

  // Seed Inventory for Coffee at Central Cafe
  const sglVariant = espressoProduct.variants.find((v) => v.sku === 'COF-ESP-SGL')!;
  const dblVariant = espressoProduct.variants.find((v) => v.sku === 'COF-ESP-DBL')!;

  const invSgl = await prisma.inventoryItem.create({
    data: {
      organizationId: org.id,
      productVariantId: sglVariant.id,
      locationId: centralCafe.id,
      stockOnHand: 150,
      minimumStock: 20,
      reorderPoint: 30,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: org.id,
      inventoryItemId: invSgl.id,
      type: 'PURCHASE_RECEIPT',
      quantity: 150,
      balanceAfter: 150,
      notes: 'Initial opening stock receipt',
      userId: adminUser.id,
    },
  });

  const invDbl = await prisma.inventoryItem.create({
    data: {
      organizationId: org.id,
      productVariantId: dblVariant.id,
      locationId: centralCafe.id,
      stockOnHand: 8, // Low stock on purpose to test alerts!
      minimumStock: 10,
      reorderPoint: 25,
    },
  });

  await prisma.stockMovement.create({
    data: {
      organizationId: org.id,
      inventoryItemId: invDbl.id,
      type: 'PURCHASE_RECEIPT',
      quantity: 8,
      balanceAfter: 8,
      notes: 'Initial stock receipt (running low)',
      userId: adminUser.id,
    },
  });

  // Seed Inventory for T-Shirts at Downtown Supermarket
  for (const variant of tshirtProduct.variants) {
    const inv = await prisma.inventoryItem.create({
      data: {
        organizationId: org.id,
        productVariantId: variant.id,
        locationId: downtownBranch.id,
        stockOnHand: 50,
        minimumStock: 10,
        reorderPoint: 15,
      },
    });

    await prisma.stockMovement.create({
      data: {
        organizationId: org.id,
        inventoryItemId: inv.id,
        type: 'PURCHASE_RECEIPT',
        quantity: 50,
        balanceAfter: 50,
        notes: 'Initial opening stock',
        userId: adminUser.id,
      },
    });
  }

  // Seed a Completed Sample Sale
  const sampleSale = await prisma.sale.create({
    data: {
      organizationId: org.id,
      locationId: centralCafe.id,
      customerId: customer1.id,
      userId: cashierUser.id,
      saleNumber: 'S-2026-000001',
      channel: 'POS',
      status: 'COMPLETED',
      subtotal: 5.0, // 2 Single Shots @ 2.50
      discountTotal: 0.0,
      taxTotal: 0.5, // 10%
      grandTotal: 5.5,
      currency: 'USD',
      notes: 'Dine-in order',
      completedAt: new Date(),
      lineItems: {
        create: [
          {
            productVariantId: sglVariant.id,
            sku: sglVariant.sku,
            productName: 'Artisan Espresso',
            variantName: 'Single Shot',
            quantity: 2,
            unitPrice: 2.5,
            discount: 0,
            taxRatePct: 10,
            taxAmount: 0.5,
            lineTotal: 5.5,
          },
        ],
      },
      payments: {
        create: [
          {
            method: 'CASH',
            amount: 6.0,
            reference: null,
          },
        ],
      },
    },
  });

  console.log('Enterprise Seed complete.');
  console.log('  Org:', org.name, `(${org.id})`);
  console.log('  Customers:', customer1.name, ',', customer2.name);
  console.log('  Sale Seeded:', sampleSale.saleNumber, `($${sampleSale.grandTotal})`);
  console.log('  Login: admin@demo.test / Admin123!   (ORG_ADMIN - Unrestricted)');
  console.log('  Login: cashier@demo.test / Cashier123!  (CASHIER - Scoped to Central Cafe)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

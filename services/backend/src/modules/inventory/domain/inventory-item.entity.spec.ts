import { InventoryItemEntity } from './inventory-item.entity';

describe('InventoryItemEntity', () => {
  it('calculates available quantity correctly (stockOnHand - reservedQty)', () => {
    const item = new InventoryItemEntity(100, 20, 10, 15);
    expect(item.availableQty).toBe(80);
  });

  it('clamps available quantity at 0 if reserved exceeds stock on hand', () => {
    const item = new InventoryItemEntity(5, 10, 0, null);
    expect(item.availableQty).toBe(0);
  });

  it('identifies low stock when stock falls below or equal to reorderPoint', () => {
    const itemLow = new InventoryItemEntity(15, 0, 5, 20);
    expect(itemLow.isLowStock).toBe(true);

    const itemOk = new InventoryItemEntity(25, 0, 5, 20);
    expect(itemOk.isLowStock).toBe(false);
  });

  it('falls back to minimumStock when reorderPoint is not configured', () => {
    const itemLow = new InventoryItemEntity(8, 0, 10, null);
    expect(itemLow.isLowStock).toBe(true);

    const itemOk = new InventoryItemEntity(12, 0, 10, null);
    expect(itemOk.isLowStock).toBe(false);
  });
});

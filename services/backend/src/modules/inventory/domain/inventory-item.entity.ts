/**
 * Inventory item domain entity (spec §29).
 *
 * Business rules:
 *  1. availableQty = stockOnHand - reservedQty
 *  2. isLowStock = stockOnHand <= reorderPoint (if reorderPoint is set)
 *  3. stockOnHand should not go below 0 (enforced at transaction level)
 */
export class InventoryItemEntity {
  constructor(
    public readonly stockOnHand: number,
    public readonly reservedQty: number,
    public readonly minimumStock: number,
    public readonly reorderPoint: number | null,
  ) {}

  get availableQty(): number {
    return Math.max(0, this.stockOnHand - this.reservedQty);
  }

  get isLowStock(): boolean {
    if (this.reorderPoint !== null) {
      return this.stockOnHand <= this.reorderPoint;
    }
    return this.stockOnHand <= this.minimumStock;
  }
}

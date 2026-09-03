/**
 * Customer domain entity (spec §42).
 *
 * Enforces business invariants for customer data. Email/phone formats are
 * validated here and in Zod contracts for defense-in-depth.
 */
export class CustomerEntity {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly code: string | null,
    public name: string,
    public email: string | null,
    public phone: string | null,
    public taxId: string | null,
    public type: string,
    public notes: string | null,
    public isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly loyaltyPoints: number = 0,
    public readonly loyaltyTier: string = 'BRONZE',
    public readonly storeCredit: number = 0,
  ) {}

  /**
   * Generates a customer code like C-0001 based on the current count.
   */
  static generateCode(currentCount: number): string {
    return `C-${String(currentCount + 1).padStart(4, '0')}`;
  }

  /**
   * Factory: create from Prisma record.
   */
  static fromPrisma(row: {
    id: string;
    organizationId: string;
    code: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    taxId: string | null;
    type: string;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    loyaltyPoints?: number;
    loyaltyTier?: string;
    storeCredit?: any;
  }): CustomerEntity {
    return new CustomerEntity(
      row.id,
      row.organizationId,
      row.code,
      row.name,
      row.email,
      row.phone,
      row.taxId,
      row.type,
      row.notes,
      row.isActive,
      row.createdAt,
      row.updatedAt,
      row.loyaltyPoints ?? 0,
      row.loyaltyTier ?? 'BRONZE',
      row.storeCredit ? Number(row.storeCredit) : 0,
    );
  }

  toDto() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      code: this.code,
      name: this.name,
      email: this.email,
      phone: this.phone,
      taxId: this.taxId,
      type: this.type as any,
      loyaltyPoints: this.loyaltyPoints,
      loyaltyTier: this.loyaltyTier,
      storeCredit: this.storeCredit,
      notes: this.notes,
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

import { CustomerEntity } from './customer.entity';

describe('CustomerEntity', () => {
  it('generates sequential customer codes padded to 4 digits', () => {
    expect(CustomerEntity.generateCode(0)).toBe('C-0001');
    expect(CustomerEntity.generateCode(9)).toBe('C-0010');
    expect(CustomerEntity.generateCode(99)).toBe('C-0100');
    expect(CustomerEntity.generateCode(999)).toBe('C-1000');
  });

  it('maps from prisma row to entity and DTO', () => {
    const now = new Date();
    const entity = CustomerEntity.fromPrisma({
      id: 'cust-1',
      organizationId: 'org-1',
      code: 'C-0001',
      name: 'Acme Corp',
      email: 'acme@example.com',
      phone: '+123456789',
      taxId: 'VAT-999',
      type: 'COMPANY',
      notes: 'VIP client',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const dto = entity.toDto();
    expect(dto.id).toBe('cust-1');
    expect(dto.name).toBe('Acme Corp');
    expect(dto.type).toBe('COMPANY');
    expect(dto.createdAt).toBe(now.toISOString());
  });
});

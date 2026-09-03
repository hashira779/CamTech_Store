import { PayrollCalculator } from './payroll-calculator';

describe('PayrollCalculator', () => {
  it('computes net pay with allowances and deductions', () => {
    const item = PayrollCalculator.computeItem({
      employeeId: 'emp_1',
      baseSalary: 3000,
      allowances: 300,
      deductions: 200,
    });

    expect(item.baseSalary).toBe(3000);
    expect(item.allowances).toBe(300);
    expect(item.deductions).toBe(200);
    expect(item.netPay).toBe(3100); // 3000 + 300 - 200
  });

  it('computes batch payroll totals accurately', () => {
    const batch = PayrollCalculator.computeBatch([
      { employeeId: 'emp_1', baseSalary: 2000, allowances: 200, deductions: 100 },
      { employeeId: 'emp_2', baseSalary: 4000, allowances: 500, deductions: 300 },
    ]);

    expect(batch.items).toHaveLength(2);
    // Gross: (2000 + 200) + (4000 + 500) = 6700
    expect(batch.totalGross).toBe(6700);
    // Net: (2200 - 100) + (4500 - 300) = 2100 + 4200 = 6300
    expect(batch.totalNet).toBe(6300);
  });
});

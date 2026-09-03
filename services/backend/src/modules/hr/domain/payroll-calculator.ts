export interface PayrollEmployeeInput {
  employeeId: string;
  baseSalary: number;
  allowances?: number;
  deductions?: number;
}

export interface ComputedPayrollItem {
  employeeId: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
}

export class PayrollCalculator {
  static computeItem(input: PayrollEmployeeInput): ComputedPayrollItem {
    const base = Math.max(0, input.baseSalary);
    const allow = Math.max(0, input.allowances || 0);
    const ded = Math.max(0, input.deductions || 0);

    const net = Math.max(0, base + allow - ded);

    return {
      employeeId: input.employeeId,
      baseSalary: Number(base.toFixed(2)),
      allowances: Number(allow.toFixed(2)),
      deductions: Number(ded.toFixed(2)),
      netPay: Number(net.toFixed(2)),
    };
  }

  static computeBatch(employees: PayrollEmployeeInput[]): {
    items: ComputedPayrollItem[];
    totalGross: number;
    totalNet: number;
  } {
    let totalGross = 0;
    let totalNet = 0;

    const items = employees.map((emp) => {
      const computed = this.computeItem(emp);
      totalGross += computed.baseSalary + computed.allowances;
      totalNet += computed.netPay;
      return computed;
    });

    return {
      items,
      totalGross: Number(totalGross.toFixed(2)),
      totalNet: Number(totalNet.toFixed(2)),
    };
  }
}

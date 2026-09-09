import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, getAuthHeaders, unwrap } from '../lib/api';

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  baseSalary: number;
  status: 'ACTIVE' | 'ON_LEAVE';
}

function normalize(e: any): Employee {
  return {
    id: e.id,
    name:
      `${e.firstName || e.first_name || ''} ${e.lastName || e.last_name || ''}`.trim() ||
      e.name ||
      'Staff Member',
    email: e.email || 'staff@camtech.cam',
    department: e.department?.name || e.departmentId || 'Operations',
    position: e.position || 'Specialist',
    baseSalary: Number(e.baseSalary || e.base_salary || 2000),
    status: e.status === 'ON_LEAVE' ? 'ON_LEAVE' : 'ACTIVE'
  };
}

export function useEmployees() {
  const query = useQuery({
    queryKey: ['hr-live-employees'],
    queryFn: async (): Promise<Employee[]> => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/hr/employees`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('API offline');
        const items = unwrap(await res.json());
        return Array.isArray(items) ? items.map(normalize) : [];
      } catch {
        return [];
      }
    }
  });

  const employees = query.data || [];

  const stats = useMemo(() => {
    const totalPayroll = employees.reduce((s, e) => s + e.baseSalary, 0);
    const active = employees.filter((e) => e.status === 'ACTIVE').length;
    const departments = new Set(employees.map((e) => e.department));
    return {
      headcount: employees.length,
      active,
      onLeave: employees.length - active,
      totalPayroll,
      departmentCount: departments.size
    };
  }, [employees]);

  return {
    employees,
    stats,
    isLoading: query.isLoading,
    refetch: query.refetch
  };
}

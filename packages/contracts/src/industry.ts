export const INDUSTRY_PRESETS = [
  'RETAIL',
  'WHOLESALE',
  'SUPERMARKET',
  'CONVENIENCE_STORE',
  'RESTAURANT',
  'CAFE',
  'BAR',
  'FUEL_STATION',
  'PHARMACY',
  'ELECTRONICS',
  'SERVICES',
] as const;

export type IndustryPreset = (typeof INDUSTRY_PRESETS)[number];

export interface IndustryConfigDto {
  organizationId: string;
  activePreset: IndustryPreset;
  availablePresets: IndustryPreset[];
  features: string[];
}

export interface TableDto {
  id: string;
  tableNumber: string;
  capacity: number;
  status: 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED' | 'RESERVED' | 'CLEANING';
  section?: string;
}

export interface KDSTicketDto {
  id: string;
  orderNumber: string;
  tableNumber?: string | null;
  items: Array<{ name: string; quantity: number; notes?: string }>;
  status: 'ORDERED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  elapsedMinutes: number;
  createdAt: string;
}

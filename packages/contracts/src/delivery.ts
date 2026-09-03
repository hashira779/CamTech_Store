import { z } from 'zod';

export const VEHICLE_TYPES = ['MOTORCYCLE', 'VAN', 'TRUCK'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const DRIVER_STATUSES = ['IDLE', 'EN_ROUTE', 'OFFLINE'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const DELIVERY_STATUSES = [
  'PENDING',
  'DISPATCHED',
  'IN_TRANSIT',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURNED',
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export interface DeliveryDriverDto {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  vehicleType: VehicleType;
  licensePlate: string;
  status: DriverStatus;
  currentLat: number;
  currentLng: number;
  heading?: number;
  batteryLevel?: number;
  activeOrdersCount?: number;
  lastPingAt?: string;
}

export interface DeliveryOrderDto {
  id: string;
  organizationId: string;
  trackingNumber: string;
  saleId?: string | null;
  status: DeliveryStatus;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  destLat: number;
  destLng: number;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverVehicle?: string | null;
  codAmount: number;
  deliveryFee: number;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  proofOfDelivery?: string | null;
  notes?: string | null;
  createdAt: string;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
}

export interface LiveTrackingSnapshotDto {
  drivers: DeliveryDriverDto[];
  activeOrders: DeliveryOrderDto[];
  timestamp: string;
}

export const createDeliveryOrderSchema = z.object({
  recipientName: z.string().trim().min(1, 'Recipient name is required').max(100),
  recipientPhone: z.string().trim().min(6, 'Valid phone is required').max(30),
  deliveryAddress: z.string().trim().min(3, 'Address is required').max(300),
  destLat: z.number().min(-90).max(90),
  destLng: z.number().min(-180).max(180),
  saleId: z.string().optional().nullable(),
  codAmount: z.number().nonnegative().optional().default(0),
  deliveryFee: z.number().nonnegative().optional().default(2.5),
  notes: z.string().max(500).optional().nullable(),
  driverId: z.string().optional().nullable(),
});

export type CreateDeliveryOrderInput = z.infer<typeof createDeliveryOrderSchema>;

export const createDriverSchema = z.object({
  name: z.string().trim().min(1, 'Driver name is required').max(100),
  phone: z.string().trim().min(6, 'Phone number is required').max(30),
  vehicleType: z.enum(VEHICLE_TYPES).default('MOTORCYCLE'),
  licensePlate: z.string().trim().min(1, 'Plate is required').max(30),
  initialLat: z.number().optional().default(11.5564),
  initialLng: z.number().optional().default(104.9282),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;

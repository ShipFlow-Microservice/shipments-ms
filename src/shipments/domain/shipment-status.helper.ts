import { ShipmentStatus } from '@prisma/client';

export const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.CREATED]: [
    ShipmentStatus.DISPATCHED,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.DISPATCHED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.CANCELLED]: [],
};

export function canTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

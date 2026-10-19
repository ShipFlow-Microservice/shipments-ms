import { ShipmentStatus } from '@prisma/client';
import { VALID_TRANSITIONS, canTransition } from './shipment-status.helper';

describe('canTransition', () => {
  it('defines an entry for every shipment status', () => {
    Object.values(ShipmentStatus).forEach((status) => {
      expect(VALID_TRANSITIONS[status]).toBeDefined();
    });
  });

  describe('valid transitions', () => {
    it.each([
      [ShipmentStatus.CREATED, ShipmentStatus.DISPATCHED],
      [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED],
      [ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT],
      [ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED],
    ])('allows %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it.each([
      [ShipmentStatus.CREATED, ShipmentStatus.CREATED],
      [ShipmentStatus.CREATED, ShipmentStatus.IN_TRANSIT],
      [ShipmentStatus.CREATED, ShipmentStatus.DELIVERED],
      [ShipmentStatus.DISPATCHED, ShipmentStatus.CREATED],
      [ShipmentStatus.DISPATCHED, ShipmentStatus.DISPATCHED],
      [ShipmentStatus.DISPATCHED, ShipmentStatus.DELIVERED],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CREATED],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.DISPATCHED],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.IN_TRANSIT],
      [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
      [ShipmentStatus.DELIVERED, ShipmentStatus.CREATED],
      [ShipmentStatus.DELIVERED, ShipmentStatus.DISPATCHED],
      [ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT],
      [ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERED],
      [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED],
      [ShipmentStatus.CANCELLED, ShipmentStatus.CREATED],
      [ShipmentStatus.CANCELLED, ShipmentStatus.DISPATCHED],
      [ShipmentStatus.CANCELLED, ShipmentStatus.IN_TRANSIT],
      [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED],
      [ShipmentStatus.CANCELLED, ShipmentStatus.CANCELLED],
    ])('rejects %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  describe('cancellation policy (cancel = transition to CANCELLED)', () => {
    it('allows cancelling from CREATED and DISPATCHED', () => {
      expect(canTransition(ShipmentStatus.CREATED, ShipmentStatus.CANCELLED)).toBe(true);
      expect(canTransition(ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED)).toBe(true);
    });

    it('rejects cancelling from IN_TRANSIT, DELIVERED and CANCELLED', () => {
      expect(canTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED)).toBe(false);
      expect(canTransition(ShipmentStatus.DELIVERED, ShipmentStatus.CANCELLED)).toBe(false);
      expect(canTransition(ShipmentStatus.CANCELLED, ShipmentStatus.CANCELLED)).toBe(false);
    });
  });
});

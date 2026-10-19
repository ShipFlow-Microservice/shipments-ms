import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Shipment, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canTransition } from './domain/shipment-status.helper';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { FindAllShipmentsDto } from './dto/find-all-shipments.dto';

export type PaginatedShipments = {
  items: Shipment[];
  total: number;
  page: number;
  limit: number;
};

// Reintentos ante colisión del índice unique de trackingCode.
const TRACKING_CODE_MAX_ATTEMPTS = 5;

@Injectable()
export class ShipmentService {
  constructor(private prisma: PrismaService) {}

  // SHP-XXXXXXXX: 8 caracteres hexadecimales a partir de randomBytes.
  private generateTrackingCode(): string {
    return `SHP-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async create(createShipmentDto: CreateShipmentDto): Promise<Shipment> {
    for (let attempt = 1; attempt <= TRACKING_CODE_MAX_ATTEMPTS; attempt++) {
      try {
        // El status inicial CREATED lo aporta el @default del schema.
        return await this.prisma.shipment.create({
          data: {
            ...createShipmentDto,
            trackingCode: this.generateTrackingCode(),
          },
        });
      } catch (error) {
        const isTrackingCodeCollision =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';

        if (
          !isTrackingCodeCollision ||
          attempt === TRACKING_CODE_MAX_ATTEMPTS
        ) {
          throw error;
        }
        // Colisión de trackingCode: se reintenta con un código nuevo.
      }
    }

    // Salvaguarda inalcanzable en la práctica: la última iteración retorna o re-lanza.
    throw new ConflictException('Could not generate a unique tracking code');
  }

  async findOne(id: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }

    return shipment;
  }

  async findByTrackingCode(trackingCode: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingCode },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with trackingCode ${trackingCode} not found`,
      );
    }

    return shipment;
  }

  async findAll(findAllDto: FindAllShipmentsDto): Promise<PaginatedShipments> {
    const page = findAllDto.page ?? 1;
    const limit = findAllDto.limit ?? 10;
    const where: Prisma.ShipmentWhereInput = findAllDto.status
      ? { status: findAllDto.status }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateStatus(
    id: string,
    status: ShipmentStatus,
    note?: string,
  ): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }

    if (!canTransition(shipment.status, status)) {
      throw new BadRequestException(
        `Invalid transition from ${shipment.status} to ${status}`,
      );
    }

    return this.transitionTo(shipment, status, note);
  }

  // Cancelar es transicionar a CANCELLED, nunca un borrado físico.
  async cancel(id: string, note?: string): Promise<Shipment> {
    const shipment = await this.prisma.shipment.findUnique({ where: { id } });

    if (!shipment) {
      throw new NotFoundException(`Shipment with id ${id} not found`);
    }

    if (!canTransition(shipment.status, ShipmentStatus.CANCELLED)) {
      throw new ConflictException(
        `Shipment with status ${shipment.status} cannot be cancelled`,
      );
    }

    return this.transitionTo(shipment, ShipmentStatus.CANCELLED, note);
  }

  // Cambia el estado y escribe el log en la MISMA transacción de Prisma,
  // de modo que un envío nunca quede con estado actualizado y log perdido.
  private async transitionTo(
    shipment: Shipment,
    to: ShipmentStatus,
    note: string | undefined,
  ): Promise<Shipment> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: to },
      });

      await tx.shipmentStatusLog.create({
        data: {
          shipmentId: shipment.id,
          fromStatus: shipment.status,
          toStatus: to,
          note,
        },
      });

      return updated;
    });
  }
}

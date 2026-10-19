import { ShipmentStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateShipmentStatusDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

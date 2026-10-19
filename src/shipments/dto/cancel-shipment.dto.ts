import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelShipmentDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  note?: string;
}

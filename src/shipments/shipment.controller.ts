import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { FindAllShipmentsDto } from './dto/find-all-shipments.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';

@Controller()
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @MessagePattern('shipments.create')
  async create(@Payload() createShipmentDto: CreateShipmentDto) {
    return this.shipmentService.create(createShipmentDto);
  }

  @MessagePattern('shipments.findOne')
  async findOne(@Payload() payload: { id: string }) {
    return this.shipmentService.findOne(payload.id);
  }

  @MessagePattern('shipments.findByTrackingCode')
  async findByTrackingCode(@Payload() payload: { trackingCode: string }) {
    return this.shipmentService.findByTrackingCode(payload.trackingCode);
  }

  @MessagePattern('shipments.findAll')
  async findAll(@Payload() findAllDto: FindAllShipmentsDto) {
    return this.shipmentService.findAll(findAllDto);
  }

  @MessagePattern('shipments.cancel')
  async cancel(@Payload() cancelDto: CancelShipmentDto) {
    return this.shipmentService.cancel(cancelDto.id, cancelDto.note);
  }

  @MessagePattern('shipments.updateStatus')
  async updateStatus(@Payload() updateStatusDto: UpdateShipmentStatusDto) {
    return this.shipmentService.updateStatus(
      updateStatusDto.id,
      updateStatusDto.status,
      updateStatusDto.note,
    );
  }
}

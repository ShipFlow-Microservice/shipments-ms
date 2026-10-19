import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ShipmentModule } from './shipments/shipment.module';

@Module({
  imports: [PrismaModule, ShipmentModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

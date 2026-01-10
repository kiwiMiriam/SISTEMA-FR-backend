import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VentasService } from './ventas.service';
import { VentasController } from './ventas.controller';
import { Venta } from '../../entities/venta.entity';
import { VentaPago } from '../../entities/venta-pago.entity';
import { Cliente } from '../../entities/cliente.entity';
import { ProductosModule } from '../productos/productos.module';
import { ClientesModule } from '../clientes/clientes.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ValidationService } from '../../common/services/validation.service';
import { PuntosModule } from '../puntos/puntos.module';
import { InventarioModule } from '../inventario/inventario.module';
import { Producto } from '../../entities/producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venta, VentaPago, Cliente, Producto]),
    ProductosModule,
    ClientesModule,
    WhatsappModule,
    PuntosModule,
    InventarioModule,
  ],
  controllers: [VentasController],
  providers: [VentasService, ValidationService],
  exports: [VentasService],
})
export class VentasModule {}

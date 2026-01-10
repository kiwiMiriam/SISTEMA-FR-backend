import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventarioService } from './inventario.service';
import { Producto } from '../../entities/producto.entity';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Producto, MovimientoInventario]),
  ],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PuntosService } from './puntos.service';
import { PuntosController } from './puntos.controller';
import { Cliente } from '../../entities/cliente.entity';
import { ClientePuntosMovimiento } from '../../entities/cliente-puntos-movimiento.entity';
import { Producto } from '../../entities/producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Cliente,
      ClientePuntosMovimiento,
      Producto
    ])
  ],
  controllers: [PuntosController],
  providers: [PuntosService],
  exports: [PuntosService],
})
export class PuntosModule {}

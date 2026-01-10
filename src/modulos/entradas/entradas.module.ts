import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntradasService } from './entradas.service';
import { EntradasController } from './entradas.controller';
import { Entrada } from '../../entities/entrada.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Entrada])
  ],
  controllers: [EntradasController],
  providers: [EntradasService],
  exports: [EntradasService],
})
export class EntradasModule {}

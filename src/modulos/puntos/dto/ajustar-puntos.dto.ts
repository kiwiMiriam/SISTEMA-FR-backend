import { IsNotEmpty, IsNumber, IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoMovimientoPuntos } from '../../../entities/cliente-puntos-movimiento.entity';

export class AjustarPuntosDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 5
  })
  @IsNotEmpty({ message: 'El ID del cliente es obligatorio' })
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clienteId: number;

  @ApiProperty({
    description: 'Cantidad de puntos a ajustar (positivo para agregar, negativo para quitar)',
    example: 50
  })
  @IsNotEmpty({ message: 'Los puntos son obligatorios' })
  @IsNumber({}, { message: 'Los puntos deben ser un número' })
  puntos: number;

  @ApiProperty({
    description: 'Motivo del ajuste',
    example: 'Corrección por error en sistema',
    maxLength: 500
  })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsString({ message: 'El motivo debe ser texto' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  motivo: string;

  @ApiProperty({
    description: 'Tipo de movimiento',
    enum: TipoMovimientoPuntos,
    example: TipoMovimientoPuntos.AJUSTE
  })
  @IsEnum(TipoMovimientoPuntos, { message: 'Tipo de movimiento inválido' })
  tipo: TipoMovimientoPuntos;
}

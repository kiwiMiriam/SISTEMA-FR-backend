import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsEnum, IsOptional, Min } from 'class-validator';
import { TipoMovimiento } from '../../../common/enums';

/**
 * DTO para consultar movimientos de inventario
 */
export class ConsultarMovimientosDto {
  @ApiProperty({
    description: 'ID del producto para filtrar movimientos',
    example: 1,
    required: false
  })
  @IsOptional()
  @IsNumber()
  productoId?: number;

  @ApiProperty({
    description: 'ID de la venta para filtrar movimientos',
    example: 123,
    required: false
  })
  @IsOptional()
  @IsNumber()
  ventaId?: number;

  @ApiProperty({
    description: 'Tipo de movimiento',
    enum: TipoMovimiento,
    required: false
  })
  @IsOptional()
  @IsEnum(TipoMovimiento)
  tipoMovimiento?: TipoMovimiento;

  @ApiProperty({
    description: 'Límite de resultados',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 50;
}

/**
 * DTO para respuesta de movimiento de inventario
 */
export class MovimientoInventarioResponseDto {
  @ApiProperty({
    description: 'ID del movimiento',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: 'Información del producto',
    example: {
      id: 1,
      descripcion: 'Coca Cola 500ml',
      codigoBarra: '7751234567890'
    }
  })
  producto: {
    id: number;
    descripcion: string;
    codigoBarra: string;
  };

  @ApiProperty({
    description: 'Tipo de movimiento',
    enum: TipoMovimiento,
    example: TipoMovimiento.SALIDA
  })
  tipoMovimiento: TipoMovimiento;

  @ApiProperty({
    description: 'Cantidad del movimiento',
    example: 5
  })
  cantidad: number;

  @ApiProperty({
    description: 'Stock anterior al movimiento',
    example: 100
  })
  stockAnterior: number;

  @ApiProperty({
    description: 'Stock después del movimiento',
    example: 95
  })
  stockNuevo: number;

  @ApiProperty({
    description: 'Motivo del movimiento',
    example: 'Venta #123'
  })
  motivo: string;

  @ApiProperty({
    description: 'Usuario que registró el movimiento',
    example: 'admin'
  })
  registradoPor: string;

  @ApiProperty({
    description: 'ID de la venta relacionada (si aplica)',
    example: 123,
    required: false
  })
  ventaId?: number;

  @ApiProperty({
    description: 'Fecha del movimiento',
    example: '2024-12-19T21:57:35.898Z'
  })
  fechaMovimiento: Date;
}

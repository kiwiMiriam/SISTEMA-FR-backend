import { IsNotEmpty, IsNumber, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ItemPreviewDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @IsNumber({}, { message: 'El ID del producto debe ser un número' })
  productoId: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    example: 2
  })
  @IsNotEmpty({ message: 'La cantidad es obligatoria' })
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(1, { message: 'La cantidad debe ser mayor a 0' })
  cantidad: number;
}

export class PreviewVentaDto {
  @ApiProperty({
    description: 'Items de la venta',
    type: [ItemPreviewDto],
    example: [
      { productoId: 1, cantidad: 2 },
      { productoId: 3, cantidad: 1 }
    ]
  })
  @IsArray({ message: 'Los items deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => ItemPreviewDto)
  items: ItemPreviewDto[];

  @ApiProperty({
    description: 'ID del cliente (opcional, para aplicar puntos)',
    example: 5,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clienteId?: number;

  @ApiProperty({
    description: 'Puntos que el cliente quiere usar (opcional)',
    example: 30,
    required: false
  })
  @IsOptional()
  @IsNumber({}, { message: 'Los puntos deben ser un número' })
  @Min(0, { message: 'Los puntos no pueden ser negativos' })
  puntosAUsar?: number;

  @ApiProperty({
    description: 'Monto que entrega el cliente',
    example: 35.00
  })
  @IsNotEmpty({ message: 'El monto recibido es obligatorio' })
  @IsNumber({}, { message: 'El monto recibido debe ser un número' })
  @Min(0, { message: 'El monto recibido no puede ser negativo' })
  montoRecibido: number;
}

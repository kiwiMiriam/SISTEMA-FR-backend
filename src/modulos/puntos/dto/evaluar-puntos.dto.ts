import { IsNotEmpty, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class ItemVentaDto {
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

export class EvaluarPuntosDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 5
  })
  @IsNotEmpty({ message: 'El ID del cliente es obligatorio' })
  @IsNumber({}, { message: 'El ID del cliente debe ser un número' })
  clienteId: number;

  @ApiProperty({
    description: 'Items de la venta para calcular límites',
    type: [ItemVentaDto],
    example: [
      { productoId: 1, cantidad: 2 },
      { productoId: 3, cantidad: 1 }
    ]
  })
  @IsArray({ message: 'Los items deben ser un array' })
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items: ItemVentaDto[];

  @ApiProperty({
    description: 'Puntos que el cliente quiere usar',
    example: 30
  })
  @IsNotEmpty({ message: 'Los puntos solicitados son obligatorios' })
  @IsNumber({}, { message: 'Los puntos solicitados deben ser un número' })
  @Min(0, { message: 'Los puntos solicitados no pueden ser negativos' })
  puntosSolicitados: number;
}

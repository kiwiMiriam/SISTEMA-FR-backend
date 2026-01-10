import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para consultar cálculos de venta sin persistir
 */
export class ConsultaVentaDto {
  @ApiProperty({
    description: 'ID del cliente (opcional)',
    example: 1,
    required: false
  })
  @IsOptional()
  @IsNumber()
  clienteId?: number;

  @ApiProperty({
    description: 'Lista de productos para la venta',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productoId: { type: 'number', example: 1 },
        cantidad: { type: 'number', example: 2 }
      }
    }
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductoConsultaDto)
  productos: ProductoConsultaDto[];

  @ApiProperty({
    description: 'Descuento aplicado',
    example: 5.00,
    default: 0,
    required: false
  })
  @IsOptional()
  @IsNumber()
  descuento?: number;

  @ApiProperty({
    description: 'Recargo extra aplicado',
    example: 2.00,
    default: 0,
    required: false
  })
  @IsOptional()
  @IsNumber()
  recargoExtra?: number;

  @ApiProperty({
    description: 'Puntos que el cliente quiere usar',
    example: 50,
    default: 0,
    required: false
  })
  @IsOptional()
  @IsNumber()
  puntosUsados?: number;

  @ApiProperty({
    description: 'Monto total que el cliente va a pagar',
    example: 20.00
  })
  @IsNumber()
  montoPagado: number;
}

/**
 * DTO para producto en consulta
 */
export class ProductoConsultaDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsNumber()
  productoId: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    example: 2
  })
  @IsNumber()
  cantidad: number;
}

/**
 * DTO de respuesta para consulta de venta
 */
export class ConsultaVentaResponseDto {
  @ApiProperty({
    description: 'Subtotal de productos',
    example: 15.00
  })
  subtotal: number;

  @ApiProperty({
    description: 'Descuento por puntos aplicado',
    example: 2.50
  })
  descuentoPorPuntos: number;

  @ApiProperty({
    description: 'Descuento total aplicado',
    example: 7.50
  })
  descuentoTotal: number;

  @ApiProperty({
    description: 'Recargo extra aplicado',
    example: 2.00
  })
  recargoExtra: number;

  @ApiProperty({
    description: 'Total antes de redondeo',
    example: 9.50
  })
  total: number;

  @ApiProperty({
    description: 'Ajuste por redondeo aplicado',
    example: 0.50
  })
  ajusteRedondeo: number;

  @ApiProperty({
    description: 'Total que efectivamente paga el cliente',
    example: 10.00
  })
  totalCobrado: number;

  @ApiProperty({
    description: 'Puntos que se otorgarán al cliente',
    example: 10
  })
  puntosOtorgados: number;

  @ApiProperty({
    description: 'Vuelto a entregar',
    example: 10.00
  })
  vuelto: number;

  @ApiProperty({
    description: 'Desglose de productos validados',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        productoId: { type: 'number', example: 1 },
        descripcion: { type: 'string', example: 'Coca Cola 500ml' },
        cantidad: { type: 'number', example: 2 },
        precioUnitario: { type: 'number', example: 2.50 },
        subtotal: { type: 'number', example: 5.00 },
        stockDisponible: { type: 'number', example: 100 }
      }
    }
  })
  productos: Array<{
    productoId: number;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    stockDisponible: number;
  }>;

  @ApiProperty({
    description: 'Información del cliente (si aplica)',
    required: false
  })
  cliente?: {
    id: number;
    nombreCompleto: string;
    puntosDisponibles: number;
    puntosUsados: number;
    puntosRestantes: number;
  };

  @ApiProperty({
    description: 'Validaciones y alertas',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        tipo: { type: 'string', example: 'warning' },
        mensaje: { type: 'string', example: 'Stock bajo para Coca Cola 500ml' }
      }
    }
  })
  validaciones: Array<{
    tipo: 'error' | 'warning' | 'info';
    mensaje: string;
  }>;
}

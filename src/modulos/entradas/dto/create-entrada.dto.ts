import { IsNotEmpty, IsNumber, IsString, IsOptional, IsDateString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateEntradaDto {
  @ApiProperty({
    description: 'Monto del ingreso',
    example: 150.50,
    minimum: 0.01
  })
  @IsNotEmpty({ message: 'El monto es obligatorio' })
  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Transform(({ value }) => parseFloat(value))
  monto: number;

  @ApiProperty({
    description: 'Descripción detallada del ingreso',
    example: 'Donación de cliente por excelente servicio',
    maxLength: 500
  })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @IsString({ message: 'La descripción debe ser texto' })
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion: string;

  @ApiPropertyOptional({
    description: 'Categoría del ingreso',
    example: 'DONACION',
    maxLength: 100
  })
  @IsOptional()
  @IsString({ message: 'La categoría debe ser texto' })
  @MaxLength(100, { message: 'La categoría no puede exceder 100 caracteres' })
  categoria?: string;

  @ApiPropertyOptional({
    description: 'Fecha del ingreso (formato YYYY-MM-DD)',
    example: '2025-01-09'
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe tener formato válido YYYY-MM-DD' })
  @Type(() => Date)
  fecha?: Date;

  @ApiPropertyOptional({
    description: 'Observaciones adicionales',
    example: 'Cliente muy satisfecho con el producto',
    maxLength: 1000
  })
  @IsOptional()
  @IsString({ message: 'Las observaciones deben ser texto' })
  @MaxLength(1000, { message: 'Las observaciones no pueden exceder 1000 caracteres' })
  observaciones?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsString, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * DTO para análisis de empresa por ticker
 */
export class AnalyzeCompanyDto {
  @ApiPropertyOptional({
    description: 'Forzar actualización de datos (ignorar caché)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  forceRefresh?: boolean = false;

  @ApiPropertyOptional({
    description: 'Indica si la empresa es manufacturera (afecta el cálculo de Altman Z-Score)',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isManufacturing?: boolean = true;
}

/**
 * DTO para datos financieros manuales
 */
export class ManualFinancialDataDto {
  @ApiProperty({ description: 'Ingresos totales', example: 1000000 })
  @IsNumber()
  @Min(0)
  revenue: number;

  @ApiProperty({ description: 'Utilidad neta', example: 100000 })
  @IsNumber()
  netIncome: number;

  @ApiProperty({ description: 'Activos totales', example: 2000000 })
  @IsNumber()
  @Min(1)
  totalAssets: number;

  @ApiProperty({ description: 'Pasivos totales', example: 800000 })
  @IsNumber()
  @Min(0)
  totalLiabilities: number;

  @ApiProperty({ description: 'Flujo de efectivo operativo', example: 150000 })
  @IsNumber()
  operatingCashFlow: number;

  @ApiProperty({ description: 'Activos corrientes', example: 500000 })
  @IsNumber()
  @Min(0)
  currentAssets: number;

  @ApiProperty({ description: 'Pasivos corrientes', example: 300000 })
  @IsNumber()
  @Min(0)
  currentLiabilities: number;

  @ApiPropertyOptional({ description: 'Utilidad bruta', example: 400000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossProfit?: number;

  @ApiPropertyOptional({ description: 'Utilidad operativa', example: 120000 })
  @IsOptional()
  @IsNumber()
  operatingIncome?: number;

  @ApiPropertyOptional({ description: 'EBITDA', example: 140000 })
  @IsOptional()
  @IsNumber()
  ebitda?: number;

  @ApiPropertyOptional({ description: 'Deuda a largo plazo', example: 200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  longTermDebt?: number;

  @ApiPropertyOptional({ description: 'Patrimonio de accionistas', example: 1200000 })
  @IsOptional()
  @IsNumber()
  shareholdersEquity?: number;

  @ApiPropertyOptional({ description: 'Utilidades retenidas', example: 300000 })
  @IsOptional()
  @IsNumber()
  retainedEarnings?: number;

  @ApiPropertyOptional({ description: 'Capital de trabajo', example: 200000 })
  @IsOptional()
  @IsNumber()
  workingCapital?: number;

  @ApiPropertyOptional({ description: 'Flujo de efectivo libre', example: 100000 })
  @IsOptional()
  @IsNumber()
  freeCashFlow?: number;

  @ApiPropertyOptional({ description: 'Gastos de capital', example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capitalExpenditures?: number;

  @ApiPropertyOptional({ description: 'Acciones en circulación', example: 1000000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  sharesOutstanding?: number;

  @ApiPropertyOptional({ description: 'Valor en libros', example: 1.2 })
  @IsOptional()
  @IsNumber()
  bookValue?: number;

  @ApiPropertyOptional({ description: 'Valor tangible en libros', example: 1.0 })
  @IsOptional()
  @IsNumber()
  tangibleBookValue?: number;

  @ApiPropertyOptional({ description: 'Capitalización de mercado', example: 5000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  marketCap?: number;

  @ApiPropertyOptional({ description: 'Sector de la empresa', example: 'Technology' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional({ description: 'Industria de la empresa', example: 'Software' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Moneda', example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  // Datos históricos opcionales para comparaciones
  @ApiPropertyOptional({ description: 'Ingresos del año anterior', example: 900000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  previousYearRevenue?: number;

  @ApiPropertyOptional({ description: 'Utilidad neta del año anterior', example: 80000 })
  @IsOptional()
  @IsNumber()
  previousYearNetIncome?: number;

  @ApiPropertyOptional({ description: 'Activos totales del año anterior', example: 1800000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  previousYearAssets?: number;

  @ApiPropertyOptional({ description: 'Patrimonio del año anterior', example: 1100000 })
  @IsOptional()
  @IsNumber()
  previousYearEquity?: number;
}

/**
 * DTO para análisis de datos manuales
 */
export class AnalyzeManualDataDto {
  @ApiProperty({
    description: 'Datos financieros actuales',
    type: ManualFinancialDataDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ManualFinancialDataDto)
  currentData: ManualFinancialDataDto;

  @ApiPropertyOptional({
    description: 'Datos financieros del período anterior (para comparaciones)',
    type: ManualFinancialDataDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ManualFinancialDataDto)
  previousData?: ManualFinancialDataDto;

  @ApiPropertyOptional({
    description: 'Indica si la empresa es manufacturera',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isManufacturing?: boolean = true;

  @ApiPropertyOptional({
    description: 'Nombre de la empresa',
    example: 'Mi Empresa S.A.',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Ticker o símbolo de la empresa',
    example: 'MYCO',
  })
  @IsOptional()
  @IsString()
  ticker?: string;
}

/**
 * DTO para análisis histórico
 */
export class HistoricalAnalysisDto {
  @ApiPropertyOptional({
    description: 'Número de períodos históricos a obtener',
    default: 4,
    minimum: 1,
    maximum: 20,
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  @Transform(({ value }) => parseInt(value))
  periods?: number = 4;
}

/**
 * DTO para respuesta de análisis
 */
export class AnalysisResponseDto {
  @ApiProperty({ description: 'Indica si el análisis fue exitoso' })
  success: boolean;

  @ApiPropertyOptional({ description: 'Datos del análisis (si fue exitoso)' })
  data?: any;

  @ApiPropertyOptional({ description: 'Mensaje de error (si falló)' })
  error?: string;

  @ApiPropertyOptional({ description: 'Indica si los datos provienen del caché' })
  fromCache?: boolean;

  @ApiProperty({ description: 'Timestamp de la respuesta' })
  timestamp: string;
}

/**
 * DTO para upload de archivos
 */
export class UploadReportDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Archivo Excel o CSV con estados financieros',
  })
  file: any;

  @ApiPropertyOptional({
    description: 'Nombre de la empresa',
    example: 'Mi Empresa S.A.',
  })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Indica si la empresa es manufacturera',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isManufacturing?: boolean = true;
}

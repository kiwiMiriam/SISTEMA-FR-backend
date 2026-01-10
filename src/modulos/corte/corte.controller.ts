import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { CorteService } from './corte.service';
import { CorteExcelService } from './corte-excel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { DateRangeDto } from '../../common/dto/date-range.dto';

@ApiTags('Corte de Caja')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('corte')
export class CorteController {
  constructor(
    private readonly corteService: CorteService,
    private readonly corteExcelService: CorteExcelService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Obtener corte de caja completo' })
  @ApiResponse({ status: 200, description: 'Corte de caja calculado exitosamente' })
  async obtenerCorteCompleto(@Query() dateRangeDto: DateRangeDto) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    return await this.corteService.calcularCorteCompleto(fechaInicio, fechaFin);
  }

  @Get('estadisticas')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Obtener estadísticas rápidas del corte' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async obtenerEstadisticasRapidas(@Query() dateRangeDto: DateRangeDto) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    return await this.corteService.obtenerEstadisticasRapidas(fechaInicio, fechaFin);
  }

  @Get('export')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Exportar corte de caja a Excel' })
  @ApiResponse({ 
    status: 200, 
    description: 'Archivo Excel generado exitosamente',
    headers: {
      'Content-Type': {
        description: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      'Content-Disposition': {
        description: 'attachment; filename="corte-caja-YYYY-MM-DD.xlsx"'
      }
    }
  })
  async exportarCorteExcel(
    @Query() dateRangeDto: DateRangeDto,
    @Res() res: Response,
  ) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    
    // Generar archivo Excel
    const buffer = await this.corteExcelService.generarCorteExcel(fechaInicio, fechaFin);
    
    // Configurar headers para descarga
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
    const fechaFinStr = fechaFin.toISOString().split('T')[0];
    const filename = `corte-caja-${fechaInicioStr}-${fechaFinStr}.xlsx`;
    
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  }
}

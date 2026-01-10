import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EntradasService } from './entradas.service';
import { CreateEntradaDto } from './dto/create-entrada.dto';
import { UpdateEntradaDto } from './dto/update-entrada.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { DateRangeDto } from '../../common/dto/date-range.dto';

@ApiTags('Entradas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('entradas')
export class EntradasController {
  constructor(private readonly entradasService: EntradasService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Crear nueva entrada' })
  @ApiResponse({ status: 201, description: 'Entrada creada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(@Body() createEntradaDto: CreateEntradaDto, @Request() req) {
    return await this.entradasService.create(createEntradaDto, req.user.username);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Obtener todas las entradas con paginación' })
  @ApiQuery({ name: 'page', required: false, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Entradas por página', example: 10 })
  @ApiResponse({ status: 200, description: 'Lista de entradas obtenida exitosamente' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return await this.entradasService.findAll(page, limit);
  }

  @Get('rango')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Obtener entradas por rango de fechas' })
  @ApiResponse({ status: 200, description: 'Entradas obtenidas exitosamente' })
  async findByDateRange(@Query() dateRangeDto: DateRangeDto) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    return await this.entradasService.findByDateRange(fechaInicio, fechaFin);
  }

  @Get('total-rango')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Calcular total de entradas por rango de fechas' })
  @ApiResponse({ status: 200, description: 'Total calculado exitosamente' })
  async calcularTotalPorRango(@Query() dateRangeDto: DateRangeDto) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    const total = await this.entradasService.calcularTotalPorRango(fechaInicio, fechaFin);
    
    return {
      fechaInicio: fechaInicio.toISOString().split('T')[0],
      fechaFin: fechaFin.toISOString().split('T')[0],
      totalEntradas: total,
      totalFormateado: `S/ ${total.toFixed(2)}`
    };
  }

  @Get('estadisticas')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtener estadísticas de entradas' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async obtenerEstadisticas(@Query() dateRangeDto?: DateRangeDto) {
    let fechaInicio: Date | undefined;
    let fechaFin: Date | undefined;

    if (dateRangeDto?.fechaInicio && dateRangeDto?.fechaFin) {
      const range = dateRangeDto.getDateRange();
      fechaInicio = range.fechaInicio;
      fechaFin = range.fechaFin;
    }

    return await this.entradasService.obtenerEstadisticas(fechaInicio, fechaFin);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ summary: 'Obtener entrada por ID' })
  @ApiResponse({ status: 200, description: 'Entrada obtenida exitosamente' })
  @ApiResponse({ status: 404, description: 'Entrada no encontrada' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.entradasService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar entrada' })
  @ApiResponse({ status: 200, description: 'Entrada actualizada exitosamente' })
  @ApiResponse({ status: 404, description: 'Entrada no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEntradaDto: UpdateEntradaDto,
  ) {
    return await this.entradasService.update(id, updateEntradaDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar entrada' })
  @ApiResponse({ status: 200, description: 'Entrada eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Entrada no encontrada' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.entradasService.remove(id);
  }
}

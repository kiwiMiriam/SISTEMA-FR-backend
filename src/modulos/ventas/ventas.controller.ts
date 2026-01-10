import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  UseGuards, 
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VentasService } from './ventas.service';
import { CreateVentaDto } from './dto/create-venta.dto';
import { PreviewVentaDto } from './dto/preview-venta.dto';
import { UpdateVentaComentarioDto } from './dto/update-venta-comentario.dto';
import { SalesCutoffDto } from './dto/sales-cutoff.dto';
import { ConsultaVentaDto, ConsultaVentaResponseDto } from './dto/consulta-venta.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, Usuario } from '../../entities/usuario.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DateRangeDto, PaginasRangoDto } from '../../common/dto/date-range.dto';

/**
 * Controlador de Ventas
 * Maneja todos los endpoints relacionados con ventas:
 * - Crear nuevas ventas
 * - Consultar ventas por diversos criterios
 * - Anular ventas
 * - Obtener estadísticas
 */
@ApiTags('Ventas')
@Controller('ventas')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class VentasController {
  constructor(private readonly ventasService: VentasService) {}

  /**
   * Previsualizar una venta sin persistir datos
   * Calcula subtotal, promociones, puntos, redondeo y vuelto
   * Elimina lógica del frontend y centraliza cálculos
   */
  @Post('preview')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Previsualizar venta sin persistir datos',
    description: 'Calcula subtotal, aplica promociones, aplica puntos, calcula redondeo y vuelto sin guardar en base de datos. Elimina lógica del frontend.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Previsualización completada',
    schema: {
      type: 'object',
      properties: {
        subtotal: { type: 'number', example: 45.00 },
        descuentoPromos: { type: 'number', example: 5.00 },
        descuentoPuntos: { type: 'number', example: 6.20 },
        ajusteRedondeo: { type: 'number', example: -0.20 },
        total: { type: 'number', example: 33.60 },
        totalCobrado: { type: 'number', example: 33.40 },
        vuelto: { type: 'number', example: 1.60 },
        puntosOtorgados: { type: 'number', example: 3 },
        detalleItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productoId: { type: 'number' },
              nombre: { type: 'string' },
              precio: { type: 'number' },
              cantidad: { type: 'number' },
              subtotal: { type: 'number' }
            }
          }
        },
        validaciones: {
          type: 'object',
          properties: {
            stockSuficiente: { type: 'boolean' },
            puntosValidos: { type: 'boolean' },
            mensajes: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o productos no encontrados' })
  async previewVenta(@Body() previewVentaDto: PreviewVentaDto) {
    return await this.ventasService.previewVenta(
      previewVentaDto.items,
      previewVentaDto.clienteId,
      previewVentaDto.puntosAUsar,
      previewVentaDto.montoRecibido
    );
  }

  /**
   * Consultar cálculos de venta sin persistir
   * - Valida productos y stock
   * - Calcula totales, puntos y redondeo
   * - Retorna desglose completo sin crear venta
   * - Permite al frontend obtener datos calculados del backend
   */
  @Post('consulta')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Consultar cálculos de venta',
    description: 'Obtiene todos los cálculos de una venta sin persistir. Elimina duplicación de lógica entre frontend y backend.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cálculos obtenidos exitosamente',
    type: ConsultaVentaResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o stock insuficiente' })
  async consultarCalculosVenta(@Body() consultaDto: ConsultaVentaDto): Promise<ConsultaVentaResponseDto> {
    return await this.ventasService.consultarCalculosVenta(consultaDto);
  }

  /**
   * Crear una nueva venta
   * - Valida cliente, productos y disponibilidad
   * - Descuenta stock del inventario
   * - Actualiza puntos del cliente
   * - Envía notificación por WhatsApp
   */
  @Post()
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Crear nueva venta',
    description: 'Crea una venta con validaciones completas. Puede ser anónima o de cliente registrado.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Venta creada exitosamente',
    schema: {
      example: {
        id: 1,
        ticketId: '20241205-0001',
        total: 20.00,
        puntosOtorgados: 20,
        estado: 'COMPLETADO'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o stock insuficiente' })
  @ApiResponse({ status: 404, description: 'Cliente o producto no encontrado' })
  create(@Body() createVentaDto: CreateVentaDto, @CurrentUser() user: Usuario) {
    return this.ventasService.create(createVentaDto, user.username);
  }

  /**
   * Obtener todas las ventas con paginación
   */
  @Get()
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener todas las ventas',
    description: 'Retorna un listado de todas las ventas del sistema'
  })
  @ApiResponse({ status: 200, description: 'Lista de ventas obtenida exitosamente' })
  findAll() {
    return this.ventasService.findAll();
  }

  /**
   * Obtener ventas del día actual
   */
  @Get('hoy')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener ventas del día actual',
    description: 'Retorna todas las ventas completadas del día actual con resumen'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Ventas del día obtenidas exitosamente',
    schema: {
      example: {
        ventas: [],
        totalVentas: 5,
        totalMonto: 150.50
      }
    }
  })
  getVentasDelDia() {
    return this.ventasService.getVentasDelDia();
  }

  /**
   * Obtener estadísticas de ventas por rango de fechas
   */
  @Get('estadisticas')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener estadísticas de ventas',
    description: 'Retorna estadísticas detalladas (total, promedio, métodos de pago, top productos)'
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  getEstadisticas(@Query() dateRangeDto: DateRangeDto) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();
    return this.ventasService.getEstadisticasVentas(fechaInicio, fechaFin);
  }

  /**
   * Obtener ventas por rango de fechas
   */
  @Get('rango')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener ventas por rango de fechas',
    description: 'Retorna un listado paginado de ventas dentro de un rango de fechas'
  })
  @ApiResponse({ status: 200, description: 'Ventas del rango obtenidas exitosamente' })
  findByDateRange(
    @Query() dateRangeDto: PaginasRangoDto
  ) {
    const { fechaInicio, fechaFin } = dateRangeDto.getDateRange();

    return this.ventasService.findByDateRange(fechaInicio, fechaFin);
  }

  /**
   * Obtener ventas de un cliente específico
   */
  @Get('cliente/:clienteId')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener ventas de un cliente',
    description: 'Retorna historial de compras de un cliente específico'
  })
  @ApiResponse({ status: 200, description: 'Ventas del cliente obtenidas exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findByCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.ventasService.findByCliente(clienteId, paginationDto);
  }

  /**
   * Generar corte de ventas por rango de fechas
   * - Métricas financieras completas
   * - Desglose por métodos de pago y productos
   * - Análisis de tendencias por día
   */
  @Get('corte')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Generar corte de ventas',
    description: 'Genera un reporte completo de ventas para un rango de fechas específico'
  })
  @ApiQuery({ name: 'fechaInicio', required: false, description: 'Fecha inicio (YYYY-MM-DD HH:mm:ss)' })
  @ApiQuery({ name: 'fechaFin', required: false, description: 'Fecha fin (YYYY-MM-DD HH:mm:ss)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Corte de ventas generado exitosamente',
    type: SalesCutoffDto
  })
  @ApiResponse({ status: 400, description: 'Rango de fechas inválido' })
  getSalesCutoff(@Query() dateRangeDto: DateRangeDto): Promise<SalesCutoffDto> {
    return this.ventasService.getSalesCutoffReport(dateRangeDto);
  }

  /**
   * Obtener venta por ticket ID
   */
  @Get('ticket/:ticketId')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener venta por ticket ID',
    description: 'Retorna los detalles de una venta usando su número de ticket único'
  })
  @ApiResponse({ status: 200, description: 'Venta encontrada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  findByTicketId(@Param('ticketId') ticketId: string) {
    return this.ventasService.findByTicketId(ticketId);
  }

  /**
   * Obtener venta por ID
   */
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener venta por ID',
    description: 'Retorna los detalles completos de una venta por su ID'
  })
  @ApiResponse({ status: 200, description: 'Venta encontrada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ventasService.findById(id);
  }

  /**
   * Actualizar comentario de una venta
   * - Solo permite modificar el comentario
   * - Valida que la venta no esté anulada
   * - Registra auditoría del cambio
   */
  @Patch(':id/comentario')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Actualizar comentario de venta',
    description: 'Permite actualizar únicamente el comentario de una venta existente'
  })
  @ApiResponse({ status: 200, description: 'Comentario actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'No se puede modificar una venta anulada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  updateComentario(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVentaComentarioDto: UpdateVentaComentarioDto,
    @CurrentUser() user: Usuario
  ) {
    return this.ventasService.updateComentario(
      id, 
      updateVentaComentarioDto.comentario || '', 
      user.username
    );
  }

  /**
   * Anular una venta
   * - Devuelve stock de productos
   * - Revierte puntos del cliente
   * - Envía notificación por WhatsApp
   */
  @Patch(':id/anular')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Anular venta',
    description: 'Anula una venta completada y revierte todos sus efectos (stock, puntos, etc.)'
  })
  @ApiResponse({ status: 200, description: 'Venta anulada exitosamente' })
  @ApiResponse({ status: 400, description: 'La venta ya está anulada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  anularVenta(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.ventasService.anularVenta(id, user.username);
  }
}

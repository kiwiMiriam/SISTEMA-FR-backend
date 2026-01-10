import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  ParseIntPipe 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PuntosService } from './puntos.service';
import { EvaluarPuntosDto } from './dto/evaluar-puntos.dto';
import { AjustarPuntosDto } from './dto/ajustar-puntos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, Usuario } from '../../entities/usuario.entity';

@ApiTags('Puntos')
@Controller('puntos')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PuntosController {
  constructor(private readonly puntosService: PuntosService) {}

  @Post('evaluar')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Evaluar puntos disponibles para uso en venta',
    description: 'Valida puntos reales del cliente, calcula límites por productos y retorna puntos finales válidos. Elimina lógica del frontend.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Evaluación de puntos completada',
    schema: {
      type: 'object',
      properties: {
        puntosDisponibles: { type: 'number', example: 25 },
        puntosAceptados: { type: 'number', example: 25 },
        descuento: { type: 'number', example: 6.20 },
        mensaje: { type: 'string', example: 'Solo se pueden usar 25 puntos' },
        limitePorProductos: { type: 'number', example: 30 },
        detalleProductos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productoId: { type: 'number' },
              nombre: { type: 'string' },
              precio: { type: 'number' },
              cantidad: { type: 'number' },
              subtotal: { type: 'number' },
              puntosMaximos: { type: 'number' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Cliente no encontrado o datos inválidos' })
  async evaluarPuntos(@Body() evaluarPuntosDto: EvaluarPuntosDto) {
    return await this.puntosService.evaluarPuntos(
      evaluarPuntosDto.clienteId,
      evaluarPuntosDto.items,
      evaluarPuntosDto.puntosSolicitados
    );
  }

  @Get('historial/:clienteId')
  @Roles(UserRole.ADMIN, UserRole.CAJERO)
  @ApiOperation({ 
    summary: 'Obtener historial de movimientos de puntos de un cliente',
    description: 'Retorna el historial completo de acumulaciones, canjes y ajustes de puntos'
  })
  @ApiResponse({ status: 200, description: 'Historial obtenido exitosamente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async obtenerHistorialCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return await this.puntosService.obtenerHistorialCliente(clienteId);
  }

  @Post('ajustar')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Ajustar puntos de cliente manualmente (solo administradores)',
    description: 'Permite ajustes manuales de puntos con auditoría completa'
  })
  @ApiResponse({ status: 201, description: 'Ajuste realizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o saldo insuficiente' })
  @ApiResponse({ status: 403, description: 'Solo administradores pueden realizar ajustes' })
  async ajustarPuntos(
    @Body() ajustarPuntosDto: AjustarPuntosDto,
    @CurrentUser() user: Usuario
  ) {
    return await this.puntosService.ajustarPuntos(
      ajustarPuntosDto.clienteId,
      ajustarPuntosDto.puntos,
      ajustarPuntosDto.motivo,
      user.username,
      ajustarPuntosDto.tipo
    );
  }

  @Get('estadisticas')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Obtener estadísticas generales de puntos',
    description: 'Estadísticas de uso de puntos para reportes administrativos'
  })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas exitosamente' })
  async obtenerEstadisticas() {
    // TODO: Implementar estadísticas generales
    return {
      mensaje: 'Estadísticas de puntos - Por implementar',
      totalClientesConPuntos: 0,
      totalPuntosCirculacion: 0,
      totalCanjesUltimoMes: 0
    };
  }
}

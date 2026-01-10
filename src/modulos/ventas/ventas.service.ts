import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Venta } from '../../entities/venta.entity';
import { VentaPago } from '../../entities/venta-pago.entity';
import { EstadoVenta, MetodoPago, TipoCompra } from '../../common/enums';
import { Cliente } from '../../entities/cliente.entity';
import { CreateVentaDto } from './dto/create-venta.dto';
import { CreateVentaPagoDto } from './dto/venta-pago.dto';
import { SalesCutoffDto } from './dto/sales-cutoff.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { DateRangeDto } from '../../common/dto/date-range.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ProductosService } from '../productos/productos.service';
import { MoneyUtil } from '../../common/utils/money.util';
import { ClientesService } from '../clientes/clientes.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ValidationService } from '../../common/services/validation.service';
import { PuntosService } from '../puntos/puntos.service';
import { InventarioService } from '../inventario/inventario.service';

/**
 * Interfaz que representa un producto validado y procesado para una venta
 */
interface ProductoValidado {
  productoId: number;
  codigoBarra: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  valorPuntos: number;
  stockDisponible: number;
}

/**
 * Interfaz para el resumen de cálculos de una venta
 */
interface ResumenVenta {
  subTotal: number;
  descuentoPorPuntos: number;
  descuentoTotal: number;
  recargoExtra: number;
  total: number;
  totalCobrado: number;
  ajusteRedondeo: number;
  puntosOtorgados: number;
  vuelto: number;
}

/**
 * Servicio de Ventas - Maneja la creación, búsqueda y anulación de ventas
 * Incluye integración con inventario, puntos de clientes y notificaciones WhatsApp
 */
@Injectable()
export class VentasService {
  private readonly logger = new Logger(VentasService.name);

  constructor(
    @InjectRepository(Venta)
    private ventaRepository: Repository<Venta>,
    @InjectRepository(VentaPago)
    private ventaPagoRepository: Repository<VentaPago>,
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
    private productosService: ProductosService,
    private clientesService: ClientesService,
    private whatsappService: WhatsappService,
    private dataSource: DataSource,
    private validationService: ValidationService,
    private puntosService: PuntosService,
    private inventarioService: InventarioService,
  ) {}

  /**
   * Crear una nueva venta con validaciones completas
   * Valida cliente, productos, stock, puntos y calcula totales
   * Genera transacción para asegurar integridad de datos
   */
  async create(createVentaDto: CreateVentaDto, cajero: string): Promise<Venta> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE'); // Evitar condiciones de carrera

    try {
      this.logger.log(`📝 Iniciando creación de venta por ${cajero}`);

      // ===== 1. VALIDACIÓN DE CLIENTE =====
      let cliente: Cliente | null = null;
      if (createVentaDto.clienteId) {
        cliente = await this.clientesService.findById(createVentaDto.clienteId);
        if (cliente) {
          this.logger.debug(`✓ Cliente validado: ${cliente.nombreCompleto}`);
        }
      }

      // ===== 2. VALIDACIÓN Y PROCESAMIENTO DE PRODUCTOS =====
      const productosValidados = await this._validarYProcesarProductos(
        createVentaDto.listaProductos,
        queryRunner,
      );

      // ===== 3. CÁLCULO DE TOTALES =====
      // Calcular el monto real pagado desde los métodos de pago (fuente de verdad)
      const totalPagado = MoneyUtil.sum(
        createVentaDto.metodosPageo.map(p => p.monto)
      );

      const resumen = this._calcularResumenVenta(
        productosValidados,
        createVentaDto.descuento || 0,
        createVentaDto.recargoExtra || 0,
        createVentaDto.puntosUsados || 0,
        cliente,
        totalPagado, // Usar el monto real calculado desde métodos de pago
      );

      // ===== 4. VALIDACIONES CENTRALIZADAS =====
      // Validar stock suficiente para todos los productos
      await this.validationService.validarStockMultiple(
        createVentaDto.listaProductos.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad
        }))
      );

      // Validar puntos si se van a usar
      if (createVentaDto.puntosUsados && createVentaDto.puntosUsados > 0) {
        if (!cliente) {
          throw new BadRequestException('No se pueden usar puntos sin cliente');
        }
        await this.validationService.validarPuntosSuficientes(cliente.id, createVentaDto.puntosUsados);
        
        // Validar límite de puntos por productos (máximo 50% del valor)
        await this.validationService.validarLimitePuntosPorProductos(
          createVentaDto.listaProductos.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad
          })),
          createVentaDto.puntosUsados
        );
        
        this.logger.debug(
          `✓ Puntos validados: ${cliente.puntosAcumulados} >= ${createVentaDto.puntosUsados}`,
        );
      }

      // Validar montos coherentes
      const totalCalculado = MoneyUtil.sum(
        productosValidados.map(p => p.subtotal)
      ) - (createVentaDto.descuento || 0) + (createVentaDto.recargoExtra || 0);
      
      await this.validationService.validarMontosCoherentes(totalCalculado, totalPagado);

      // ===== 5. GENERAR TICKET ID =====
      const ticketId = await this._generarTicketId(queryRunner);
      this.logger.debug(`✓ Ticket generado: ${ticketId}`);

      // ===== 6. PROCESAR MÉTODOS DE PAGO NORMALIZADOS =====
      const pagosNormalizados = await this._procesarPagosNormalizados(
        createVentaDto,
        resumen.totalCobrado,
        cajero,
        queryRunner,
      );
      this.logger.debug(`✓ Pagos normalizados procesados: ${pagosNormalizados.length} métodos`);

      // ===== 7. CREAR Y GUARDAR VENTA =====
      const venta = this.ventaRepository.create({
        ...createVentaDto,
        cliente: cliente || undefined,
        listaProductos: productosValidados,
        subTotal: resumen.subTotal,
        descuento: resumen.descuentoTotal,
        recargoExtra: createVentaDto.recargoExtra || 0,
        total: resumen.total,
        ajusteRedondeo: resumen.ajusteRedondeo,
        puntosOtorgados: resumen.puntosOtorgados,
        puntosUsados: createVentaDto.puntosUsados || 0,
        montoRecibido: resumen.totalCobrado,
        vuelto: resumen.vuelto,
        ticketId,
        cajero,
        estado: EstadoVenta.COMPLETADO,
        estadoVenta: 'COMPLETADO',
      });

      const ventaGuardada = await queryRunner.manager.save(venta);

      // ===== 8. GUARDAR PAGOS NORMALIZADOS =====
      for (let i = 0; i < pagosNormalizados.length; i++) {
        const pagoData = pagosNormalizados[i];
        const ventaPago = this.ventaPagoRepository.create({
          metodoPago: pagoData.metodoPago,
          monto: pagoData.monto,
          referencia: pagoData.referencia || undefined,
          notas: pagoData.notas || undefined,
          estado: 'COMPLETADO',
          fechaRegistro: new Date(),
          registradoPor: cajero,
          secuencia: i + 1,
          ventaId: ventaGuardada.id,
        });
        await queryRunner.manager.save(ventaPago);
      }

      this.logger.log(
        `✓ Venta y ${pagosNormalizados.length} pagos guardados - ID: ${ventaGuardada.id}, Ticket: ${ticketId}`,
      );

      // ===== 9. DESCONTAR STOCK DE PRODUCTOS (usando InventarioService) =====
      try {
        await this.inventarioService.descontarStockPostVenta(
          productosValidados.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            descripcion: item.descripcion
          })),
          ventaGuardada.id,
          cajero,
          queryRunner
        );
        this.logger.debug(`✓ Stock descontado para ${productosValidados.length} productos`);
      } catch (error) {
        throw new InternalServerErrorException(
          `Error descontando stock: ${error.message}`,
        );
      }

      // ===== 10. ACTUALIZAR PUNTOS DEL CLIENTE (usando PuntosService) =====
      if (cliente) {
        // Usar puntos si es necesario
        if (createVentaDto.puntosUsados && createVentaDto.puntosUsados > 0) {
          try {
            await this.puntosService.canjearPuntosEnVenta(
              cliente.id,
              createVentaDto.puntosUsados,
              ventaGuardada.id,
              cajero
            );
            this.logger.debug(`✓ Puntos canjeados: -${createVentaDto.puntosUsados}`);
          } catch (error) {
            throw new InternalServerErrorException(`Error canjeando puntos: ${error.message}`);
          }
        }

        // Acumular puntos nuevos
        if (resumen.puntosOtorgados > 0) {
          try {
            await this.puntosService.acumularPuntosPorVenta(
              cliente.id,
              resumen.puntosOtorgados,
              ventaGuardada.id,
              cajero
            );
            this.logger.debug(`✓ Puntos acumulados: +${resumen.puntosOtorgados}`);
          } catch (error) {
            throw new InternalServerErrorException(`Error acumulando puntos: ${error.message}`);
          }
        }
      }

      // ===== 11. COMMIT TRANSACCIÓN =====
      await queryRunner.commitTransaction();
      this.logger.log(`✅ Transacción completada - Venta #${ventaGuardada.id} creada exitosamente`);

      // ===== 12. ENVIAR NOTIFICACIÓN WHATSAPP (fuera de transacción) =====
      if (cliente && cliente.telefono) {
        this._enviarNotificacionWhatsApp(cliente, ventaGuardada, resumen).catch(error => {
          this.logger.warn(`⚠️ Error enviando notificación WhatsApp: ${error.message}`);
        });
      }

      // Retornar venta con relaciones cargadas
      return this.findById(ventaGuardada.id);
    } catch (error) {
      // ROLLBACK automático al salir del catch
      await queryRunner.rollbackTransaction();

      this.logger.error(`❌ Error creando venta: ${error.message}`);

      // Re-lanzar excepciones conocidas
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      // Convertir otros errores a formato standar
      throw new InternalServerErrorException(
        `Error creando venta: ${error.message || 'Error desconocido'}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Consulta cálculos de venta sin persistir
   * Permite al frontend obtener todos los cálculos sin duplicar lógica
   */
  async consultarCalculosVenta(consultaDto: any): Promise<any> {
    this.logger.debug('🔍 Iniciando consulta de cálculos de venta');

    // ===== 1. VALIDAR PRODUCTOS =====
    const productosValidados = await this._validarYProcesarProductos(
      consultaDto.productos.map(p => ({
        productoId: p.productoId,
        cantidad: p.cantidad
      })),
      null // No necesitamos queryRunner para consultas
    );

    // ===== 2. OBTENER CLIENTE SI EXISTE =====
    let cliente: any = null;
    if (consultaDto.clienteId) {
      cliente = await this.clientesService.findById(consultaDto.clienteId);
    }

    // ===== 3. VALIDACIONES CENTRALIZADAS =====
    // Validar stock suficiente
    await this.validationService.validarStockMultiple(
      consultaDto.productos.map(item => ({
        productoId: item.productoId,
        cantidad: item.cantidad
      }))
    );

    // Validar puntos si se van a usar
    if (consultaDto.puntosUsados && consultaDto.puntosUsados > 0) {
      if (!cliente) {
        throw new BadRequestException('No se pueden usar puntos sin cliente');
      }
      await this.validationService.validarPuntosSuficientes(cliente.id, consultaDto.puntosUsados);
      
      // Validar límite de puntos por productos
      await this.validationService.validarLimitePuntosPorProductos(
        consultaDto.productos.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad
        })),
        consultaDto.puntosUsados
      );
    }

    // ===== 4. CALCULAR RESUMEN =====
    const resumen = this._calcularResumenVenta(
      productosValidados,
      consultaDto.descuento || 0,
      consultaDto.recargoExtra || 0,
      consultaDto.puntosUsados || 0,
      consultaDto.montoPagado
    );

    // ===== 5. GENERAR VALIDACIONES Y ALERTAS =====
    const validaciones: Array<{
      tipo: 'error' | 'warning' | 'info';
      mensaje: string;
    }> = [];

    // Alertas de stock bajo
    for (const producto of productosValidados) {
      if (producto.stockDisponible <= 10) {
        validaciones.push({
          tipo: 'warning' as const,
          mensaje: `Stock bajo para ${producto.descripcion} (${producto.stockDisponible} unidades)`
        });
      }
    }

    // Alerta si usa muchos puntos
    if (consultaDto.puntosUsados && cliente && consultaDto.puntosUsados > cliente.puntosAcumulados * 0.8) {
      validaciones.push({
        tipo: 'info' as const,
        mensaje: `Usando ${consultaDto.puntosUsados} de ${cliente.puntosAcumulados} puntos disponibles`
      });
    }

    // ===== 6. CONSTRUIR RESPUESTA =====
    const response = {
      subtotal: resumen.subTotal,
      descuentoPorPuntos: resumen.descuentoPorPuntos,
      descuentoTotal: resumen.descuentoTotal,
      recargoExtra: resumen.recargoExtra,
      total: resumen.total,
      ajusteRedondeo: resumen.ajusteRedondeo,
      totalCobrado: resumen.totalCobrado,
      puntosOtorgados: resumen.puntosOtorgados,
      vuelto: resumen.vuelto,
      productos: productosValidados.map(p => ({
        productoId: p.productoId,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        precioUnitario: p.precioUnitario,
        subtotal: p.subtotal,
        stockDisponible: p.stockDisponible
      })),
      cliente: cliente ? {
        id: cliente.id,
        nombreCompleto: cliente.nombreCompleto,
        puntosDisponibles: cliente.puntosAcumulados,
        puntosUsados: consultaDto.puntosUsados || 0,
        puntosRestantes: cliente.puntosAcumulados - (consultaDto.puntosUsados || 0)
      } : undefined,
      validaciones
    };

    this.logger.debug(`✅ Consulta completada: Total=${resumen.totalCobrado}, Productos=${productosValidados.length}`);
    return response;
  }

  async findAll(): Promise<Venta[]> {
    return this.ventaRepository.find({
      relations: ['cliente', 'pagos'],
      order: { fecha: 'DESC' },
    });
  }

  async findById(id: number): Promise<Venta> {
    const venta = await this.ventaRepository.findOne({
      where: { id },
      relations: ['cliente', 'pagos'],
    });
    if (!venta) {
      throw new NotFoundException('Venta no encontrada');
    }
    return venta;
  }

  /**
   * Actualiza solo el comentario de una venta existente
   */
  async updateComentario(id: number, comentario: string, usuarioActual: string): Promise<Venta> {
    this.logger.log(`Actualizando comentario de venta ${id} por usuario ${usuarioActual}`);

    // Verificar que la venta existe
    const venta = await this.findById(id);

    // Verificar que la venta no está anulada
    if (venta.estado === EstadoVenta.ANULADO) {
      throw new BadRequestException('No se puede modificar el comentario de una venta anulada');
    }

    // Actualizar solo el comentario
    const comentarioAnterior = venta.comentario;
    venta.comentario = comentario;

    const ventaActualizada = await this.ventaRepository.save(venta);

    // Log para auditoría
    this.logger.log(
      `Comentario actualizado en venta ${id}: "${comentarioAnterior}" → "${comentario}" por ${usuarioActual}`,
    );

    return ventaActualizada;
  }

  async findByTicketId(ticketId: string): Promise<Venta> {
    const venta = await this.ventaRepository.findOne({
      where: { ticketId },
      relations: ['cliente', 'pagos'],
    });
    if (!venta) {
      throw new NotFoundException('Venta no encontrada');
    }
    return venta;
  }

  async findByDateRange(
    fechaInicio: Date,
    fechaFin: Date
  ): Promise<PaginatedResult<Venta>> {
    const { page, limit, skip } = new PaginationDto();

    const [data, total] = await this.ventaRepository.findAndCount({
      where: {
        fecha: Between(fechaInicio, fechaFin),
      },
      relations: ['cliente', 'pagos'],
      skip,
      take: limit,
      order: { fecha: 'DESC' },
    });

    const totalPages = Math.ceil(total / (limit || 10));

    return {
      data,
      total,
      page: page || 1,
      limit: limit || 10,
      totalPages,
      hasNextPage: (page || 1) < totalPages,
      hasPrevPage: (page || 1) > 1,
    };
  }

  async findByCliente(
    clienteId: number,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResult<Venta>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.ventaRepository.findAndCount({
      where: { cliente: { id: clienteId } },
      relations: ['cliente', 'pagos'],
      skip,
      take: limit,
      order: { fecha: 'DESC' },
    });

    const totalPages = Math.ceil(total / (limit || 10));

    return {
      data,
      total,
      page: page || 1,
      limit: limit || 10,
      totalPages,
      hasNextPage: (page || 1) < totalPages,
      hasPrevPage: (page || 1) > 1,
    };
  }

async anularVenta(id: number, cajero: string): Promise<Venta> {
  return this.dataSource.transaction<Venta>(async manager => {
    const venta = await manager.findOne(Venta, {
      where: { id },
      relations: ['cliente', 'pagos'],
    });

    if (!venta) {
      throw new NotFoundException('Venta no encontrada');
    }

    if (venta.estado === EstadoVenta.ANULADO) {
      throw new BadRequestException('La venta ya está anulada');
    }

    // 1️⃣ Devolver stock
    for (const item of venta.listaProductos) {
      await this.productosService.devolverStock(
        item.codigoBarra,
        item.cantidad,
        cajero,
        venta.id,
      );
    }

    // 2️⃣ Revertir puntos
    if (venta.cliente) {
      if (venta.puntosOtorgados > 0) {
        await this.clientesService.canjearPuntos(
          venta.cliente.id,
          venta.puntosOtorgados,
          venta.id,
          'Anulación de venta',
        );
      }

      if (venta.puntosUsados > 0) {
        await this.clientesService.acumularPuntos(
          venta.cliente.id,
          venta.puntosUsados,
          venta.id,
          0,
        );
      }
    }

    // 3️⃣ Anular pagos
    await manager.update(
      VentaPago,
      { venta: { id } },
      { estado: 'ANULADO' },
    );

    // 4️⃣ Anular venta
    await manager.update(Venta, id, {
      estado: EstadoVenta.ANULADO,
    });

    // 5️⃣ Retornar venta anulada (SIEMPRE existe)
    const ventaAnulada = await manager.findOne(Venta, {
      where: { id },
      relations: ['cliente', 'pagos'],
    });

    if (!ventaAnulada) {
      // Esto casi nunca ocurrirá, pero deja feliz a TS y a producción
      throw new InternalServerErrorException('Error al obtener la venta anulada');
    }

    // 6️⃣ WhatsApp (fuera de lógica crítica)
    if (ventaAnulada.cliente?.telefono) {
      try {
        const mensaje =
          `⚠️ Tu venta ha sido anulada\n\n` +
          `🎫 Ticket: ${ventaAnulada.ticketId}\n` +
          `💰 Monto: S/ ${ventaAnulada.total.toFixed(2)}\n` +
          `⭐ Puntos revertidos: ${ventaAnulada.puntosOtorgados}\n`;

        await this.whatsappService.sendMessage({
          phone: ventaAnulada.cliente.telefono,
          message: mensaje,
          ventaId: id,
        });
      } catch (e) {
        this.logger.warn(`⚠️ WhatsApp falló en anulación venta ${id}: ${e.message}`);
      }
    }

    return ventaAnulada;
  });
}



  async getVentasDelDia(): Promise<{ ventas: Venta[]; totalVentas: number; totalMonto: number }> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const ventas = await this.ventaRepository.find({
      where: {
        fecha: Between(startOfDay, endOfDay),
        estado: EstadoVenta.COMPLETADO,
      },
      relations: ['cliente', 'pagos'],
      order: { fecha: 'DESC' },
    });

    const totalVentas = ventas.length;
    const totalMonto = MoneyUtil.sum(ventas.map(v => v.total));

    return { ventas, totalVentas, totalMonto };
  }

  async getEstadisticasVentas(fechaInicio: Date, fechaFin: Date): Promise<any> {
    try {
      this.logger.debug(`📊 Obteniendo estadísticas desde ${fechaInicio.toISOString()} hasta ${fechaFin.toISOString()}`);

      // ===== CONSULTA OPTIMIZADA: ESTADÍSTICAS BÁSICAS =====
      const estadisticasBasicas = await this.ventaRepository
        .createQueryBuilder('venta')
        .select([
          'COUNT(venta.id)::int as "totalVentas"',
          'COALESCE(SUM(venta.total), 0)::numeric as "totalMonto"',
          'COALESCE(SUM(venta.total + COALESCE(venta.ajusteRedondeo, 0)), 0)::numeric as "totalCobrado"',
          'COALESCE(SUM(venta.ajusteRedondeo), 0)::numeric as "totalAjustesRedondeo"',
          'COALESCE(AVG(venta.total), 0)::numeric as "promedioVenta"',
          'COALESCE(SUM(venta.descuento), 0)::numeric as "totalDescuentos"',
          'COALESCE(SUM(venta.recargoExtra), 0)::numeric as "totalRecargos"',
          'COALESCE(SUM(venta.puntosOtorgados), 0)::int as "totalPuntosOtorgados"',
          'COALESCE(SUM(venta.puntosUsados), 0)::int as "totalPuntosUsados"',
        ])
        .where('venta.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
        .andWhere('venta.estado = :estado', { estado: EstadoVenta.COMPLETADO })
        .getRawOne();

      if (!estadisticasBasicas) {
        this.logger.warn('⚠️ No se obtuvieron estadísticas básicas');
        throw new InternalServerErrorException('Error al obtener estadísticas básicas');
      }

    // ===== CONSULTA OPTIMIZADA: DESGLOSE POR MÉTODOS DE PAGO =====
    const ventasPorMetodo = await this.ventaPagoRepository
      .createQueryBuilder('pago')
      .innerJoin('pago.venta', 'venta')
      .select([
        'pago.metodoPago as "metodoPago"',
        'COUNT(DISTINCT venta.id)::int as "cantidadVentas"',
        'COALESCE(SUM(pago.monto), 0)::numeric as "montoTotal"',
      ])
      .where('venta.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
      .andWhere('venta.estado = :estado', { estado: EstadoVenta.COMPLETADO })
      .andWhere('pago.estado = :estadoPago', { estadoPago: 'COMPLETADO' })
      .andWhere('pago.metodoPago IS NOT NULL')
      .groupBy('pago.metodoPago')
      .orderBy('SUM(pago.monto)', 'DESC')
      .getRawMany();

    // ===== CONSULTA OPTIMIZADA: TOP PRODUCTOS VENDIDOS =====
    // Usar el nombre correcto de columna: listaProductos (no lista_productos)
    const topProductos = await this.dataSource.query(`
      SELECT 
        producto->>'codigoBarra' AS "codigoBarra",
        producto->>'descripcion' AS "descripcion",
        SUM((producto->>'cantidad')::integer) AS "cantidad",
        SUM((producto->>'subtotal')::numeric) AS "monto"
      FROM ventas v,
           jsonb_array_elements(v."listaProductos") AS producto
      WHERE v.fecha BETWEEN $1 AND $2
        AND v.estado = $3
      GROUP BY producto->>'codigoBarra', producto->>'descripcion'
      ORDER BY SUM((producto->>'cantidad')::integer) DESC
      LIMIT 10
    `, [fechaInicio, fechaFin, EstadoVenta.COMPLETADO]);

    // ===== CONSULTA OPTIMIZADA: VENTAS POR TIPO DE COMPRA =====
    const ventasPorTipo = await this.ventaRepository
  .createQueryBuilder('venta')
  .select([
    "COALESCE(venta.tipoCompra, 'LOCAL') as \"tipoCompra\"",
    'COUNT(venta.id)::int as "cantidadVentas"',
    'COALESCE(SUM(venta.total), 0)::numeric as "montoTotal"',
  ])
  .where('venta.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
  .andWhere('venta.estado = :estado', { estado: EstadoVenta.COMPLETADO })
  .groupBy("COALESCE(venta.tipoCompra, 'LOCAL')")
   .orderBy('SUM(venta.total)', 'DESC') // ✅
  .getRawMany();


    // ===== FORMATEAR RESULTADOS =====
    const ventasPorMetodoFormateado = ventasPorMetodo.reduce((acc, item) => {
      if (item.metodoPago && Object.values(MetodoPago).includes(item.metodoPago)) {
        acc[item.metodoPago] = {
          cantidadVentas: item.cantidadVentas || 0,
          montoTotal: MoneyUtil.round(item.montoTotal || 0),
        };
      }
      return acc;
    }, {});

    const ventasPorTipoFormateado = ventasPorTipo.reduce((acc, item) => {
      acc[item.tipoCompra] = {
        cantidadVentas: item.cantidadVentas || 0,
        montoTotal: MoneyUtil.round(item.montoTotal || 0),
      };
      return acc;
    }, {});

    const topProductosFormateado = topProductos.map(item => ({
      codigoBarra: item.codigoBarra,
      descripcion: item.descripcion,
      cantidad: parseInt(item.cantidad),
      monto: MoneyUtil.round(parseFloat(item.monto)),
    }));

    this.logger.debug(
      `✓ Estadísticas calculadas: ${estadisticasBasicas.totalVentas} ventas, ${ventasPorMetodo.length} métodos de pago`,
    );

    return {
      // Estadísticas básicas - usar valores directos de la consulta con casting
      totalVentas: estadisticasBasicas.totalVentas || 0,
      totalMonto: MoneyUtil.round(estadisticasBasicas.totalMonto || 0),
      totalCobrado: MoneyUtil.round(estadisticasBasicas.totalCobrado || 0),
      totalAjustesRedondeo: MoneyUtil.round(estadisticasBasicas.totalAjustesRedondeo || 0),
      promedioVenta: MoneyUtil.round(estadisticasBasicas.promedioVenta || 0),
      totalDescuentos: MoneyUtil.round(estadisticasBasicas.totalDescuentos || 0),
      totalRecargos: MoneyUtil.round(estadisticasBasicas.totalRecargos || 0),
      totalPuntosOtorgados: estadisticasBasicas.totalPuntosOtorgados || 0,
      totalPuntosUsados: estadisticasBasicas.totalPuntosUsados || 0,

      // Desgloses
      ventasPorMetodo: ventasPorMetodoFormateado,
      ventasPorTipo: ventasPorTipoFormateado,
      topProductos: topProductosFormateado,

      // Metadatos
      fechaInicio,
      fechaFin,
      fechaGeneracion: new Date(),
    };
    } catch (error) {
      this.logger.error(`❌ Error al obtener estadísticas de ventas: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error al obtener estadísticas de ventas: ${error.message}`);
    }
  }

  private async generateTicketId(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Contar ventas del día
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const ventasDelDia = await this.ventaRepository.count({
      where: {
        fecha: Between(startOfDay, endOfDay),
      },
    });

    const secuencial = (ventasDelDia + 1).toString().padStart(4, '0');
    return `${dateStr}-${secuencial}`;
  }

  /**
   * Valida y procesa la lista de productos de una venta
   */
  private async _validarYProcesarProductos(
    listaProductos: any[],
    queryRunner: any,
  ): Promise<ProductoValidado[]> {
    let subTotal = 0;
    const productosValidados: ProductoValidado[] = [];

    for (const item of listaProductos) {
      const producto = await this.productosService.findById(item.productoId);

      // Validar que el producto exista
      if (!producto) {
        throw new NotFoundException(`Producto con ID ${item.productoId} no encontrado`);
      }

      // Validar cantidad
      if (item.cantidad <= 0) {
        throw new BadRequestException(
          `Cantidad debe ser mayor a 0 para ${producto.productoDescripcion}`,
        );
      }

      // Verificar stock si el producto usa inventario
      if (producto.usaInventario && producto.cantidadActual < item.cantidad) {
        throw new BadRequestException(
          `Stock insuficiente para ${producto.productoDescripcion}. ` +
            `Disponible: ${producto.cantidadActual}, solicitado: ${item.cantidad}`,
        );
      }

      const precio = item.precioUnitario || producto.precio;

      if (precio <= 0) {
        throw new BadRequestException(`Precio inválido para ${producto.productoDescripcion}`);
      }

      const subtotalItem = MoneyUtil.multiply(item.cantidad, precio);

      productosValidados.push({
        productoId: producto.id,
        codigoBarra: producto.codigoBarra,
        descripcion: producto.productoDescripcion,
        cantidad: item.cantidad,
        precioUnitario: precio,
        subtotal: subtotalItem,
        valorPuntos: producto.valorPuntos || 0,
        stockDisponible: producto.cantidadActual,
      });

      subTotal += subtotalItem;
    }

    if (productosValidados.length === 0) {
      throw new BadRequestException('Debe incluir al menos un producto');
    }

    return productosValidados;
  }

  /**
   * Calcula el resumen completo de la venta (subtotal, descuentos, total, vuelto, puntos)
   * Implementa el modelo correcto de POS con ajuste de redondeo
   * @param montoRecibido - Monto real pagado calculado desde la suma de métodos de pago (fuente de verdad)
   */
  private _calcularResumenVenta(
    productosValidados: ProductoValidado[],
    descuentoManual: number = 0,
    recargoExtra: number = 0,
    puntosUsados: number = 0,
    cliente: Cliente | null,
    montoRecibido?: number,
  ): ResumenVenta {
    // Subtotal con redondeo correcto
    const subTotal = MoneyUtil.sum(productosValidados.map(p => p.subtotal));

    // Descuento por puntos (1 punto = 0.10 soles)
    const descuentoPorPuntos = MoneyUtil.round(puntosUsados * 0.1);

    // Descuento total
    const descuentoTotal = MoneyUtil.round(descuentoManual + descuentoPorPuntos);

    // Total con recargo extra - APLICAR MONEYUTIL AQUÍ
    const total = MoneyUtil.round(MoneyUtil.round(subTotal - descuentoTotal) + recargoExtra);

    // Validar que total no sea negativo
    if (total < 0) {
      throw new BadRequestException(
        `Descuento (S/ ${descuentoTotal.toFixed(2)}) no puede ser mayor al subtotal + recargo (S/ ${MoneyUtil.round(subTotal + recargoExtra).toFixed(2)})`,
      );
    }

    // ===== MODELO CORRECTO DE POS =====
    // 1. total = valor real de los productos (ya calculado arriba)
    // 2. totalCobrado = lo que efectivamente paga el cliente
    // 3. ajusteRedondeo = diferencia contable
    
    const totalCobrado = montoRecibido ? MoneyUtil.round(montoRecibido) : total;
    const ajusteRedondeo = MoneyUtil.round(totalCobrado - total);

    // Validar que el ajuste de redondeo esté dentro de tolerancia (máximo 5 céntimos)
    if (Math.abs(ajusteRedondeo) > 0.09) {
      throw new BadRequestException(
        `Ajuste de redondeo excesivo: S/ ${Math.abs(ajusteRedondeo).toFixed(2)}. Máximo permitido: S/ 0.09`,
      );
    }

    // Puntos a otorgar (1 punto por cada sol gastado, basado en el total teórico)
    const puntosOtorgados = cliente ? Math.floor(total) : 0;

     // Puntos a otorgar de acuerdo al valor de puntos de cada producto
    //const puntosOtorgados = cliente ? MoneyUtil.sum(productosValidados.map(p => p.valorPuntos)) : 0;

    // Vuelto: En POS con redondeo, normalmente es 0 porque el cliente paga exactamente totalCobrado
    // Pero si se paga más (ej: cliente da 2 soles por compra de 1.96), calcular vuelto correcto
    const vuelto = montoRecibido ? MoneyUtil.getChange(montoRecibido, totalCobrado) : 0;

    return {
      subTotal,
      descuentoPorPuntos,
      descuentoTotal,
      recargoExtra,
      total,
      totalCobrado,
      ajusteRedondeo,
      puntosOtorgados,
      vuelto,
    };
  }

  /**
   * Genera un ticket ID único con formato YYYYMMDD-XXXX
   */
  private async _generarTicketId(queryRunner: any): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const ventasDelDia = await queryRunner.manager.count(Venta, {
      where: {
        fecha: Between(startOfDay, endOfDay),
      },
    });

    const secuencial = (ventasDelDia + 1).toString().padStart(4, '0');
    return `${dateStr}-${secuencial}`;
  }

  /**
   * Genera reporte de corte de ventas por rango de fechas
   * Incluye métricas financieras, desglose por métodos de pago y productos más vendidos
   */
  async getSalesCutoffReport(dateRangeDto: DateRangeDto): Promise<SalesCutoffDto> {
    // Convertir fechas string a Date
    const fechaInicio = dateRangeDto.fechaInicio
      ? new Date(dateRangeDto.fechaInicio)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const fechaFin = dateRangeDto.fechaFin
      ? new Date(dateRangeDto.fechaFin)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    this.logger.log(
      `📊 Generando corte de ventas desde ${fechaInicio.toISOString()} hasta ${fechaFin.toISOString()}`,
    );

    try {
      // Obtener todas las ventas del período (incluyendo anuladas para estadísticas)
      const ventas = await this.ventaRepository.find({
        where: {
          fecha: Between(fechaInicio, fechaFin),
        },
        relations: ['cliente', 'pagos'],
        order: { fecha: 'ASC' },
      });

      // Filtrar ventas completadas para cálculos principales
      const ventasCompletadas = ventas.filter(v => v.estado === EstadoVenta.COMPLETADO);
      const ventasAnuladas = ventas.filter(v => v.estado === EstadoVenta.ANULADO);

      // Métricas básicas
      const totalVentas = ventasCompletadas.reduce((sum, v) => sum + v.total, 0);
      const totalCobrado = ventasCompletadas.reduce((sum, v) => sum + (v.total + (v.ajusteRedondeo || 0)), 0);
      const totalAjusteRedondeo = ventasCompletadas.reduce((sum, v) => sum + (v.ajusteRedondeo || 0), 0);
      const numeroTransacciones = ventasCompletadas.length;
      const ticketPromedio = numeroTransacciones > 0 ? totalVentas / numeroTransacciones : 0;
      const ticketPromedioCobrado = numeroTransacciones > 0 ? totalCobrado / numeroTransacciones : 0;
      const totalDescuentos = ventasCompletadas.reduce((sum, v) => sum + v.descuento, 0);
      const puntosOtorgados = ventasCompletadas.reduce((sum, v) => sum + v.puntosOtorgados, 0);
      const puntosCanjeados = ventasCompletadas.reduce((sum, v) => sum + v.puntosUsados, 0);

      // ===== CONSULTA OPTIMIZADA: DESGLOSE POR MÉTODOS DE PAGO =====
      const desgloseMetodosPagoRaw = await this.ventaPagoRepository
        .createQueryBuilder('pago')
        .innerJoin('pago.venta', 'venta')
        .select([
              'pago.metodoPago as "metodoPago"',
              'COUNT(DISTINCT venta.id)::int as "cantidad"',
              'COALESCE(SUM(pago.monto), 0)::numeric as "monto"',
            ])

        .where('venta.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
        .andWhere('venta.estado = :estado', { estado: EstadoVenta.COMPLETADO })
        .andWhere('pago.estado = :estadoPago', { estadoPago: 'COMPLETADO' })
        .andWhere('pago.metodoPago IS NOT NULL') // Solo pagos con método especificado
        .groupBy('pago.metodoPago')
        .orderBy('SUM(pago.monto)', 'DESC')
        .getRawMany();

      // Formatear desglose de métodos de pago (solo valores válidos del enum)
      const desgloseMetodosPago: { [key: string]: { cantidad: number; monto: number } } = {};
      desgloseMetodosPagoRaw.forEach(item => {
          if (!item.metodoPago) return;

          desgloseMetodosPago[item.metodoPago] = {
            cantidad: Number(item.cantidad) || 0,
            monto: MoneyUtil.round(Number(item.monto) || 0),
          };
          });


      // Nota: Código de compatibilidad temporal eliminado - ahora solo usa venta_pagos

      // Desglose por tipo de compra
      const desgloseTipoCompra: { [key: string]: { cantidad: number; monto: number } } = {};
      ventasCompletadas.forEach(venta => {
        const tipo = venta.tipoCompra || TipoCompra.LOCAL;
        if (!desgloseTipoCompra[tipo]) {
          desgloseTipoCompra[tipo] = { cantidad: 0, monto: 0 };
        }
        desgloseTipoCompra[tipo].cantidad += 1;
        desgloseTipoCompra[tipo].monto += venta.total;
      });

      // Top productos más vendidos
      const productosVendidos: {
        [key: number]: { descripcion: string; cantidad: number; monto: number };
      } = {};

      ventasCompletadas.forEach(venta => {
        venta.listaProductos.forEach((item: any) => {
          const productoId = item.productoId || item.id;
          if (!productosVendidos[productoId]) {
            productosVendidos[productoId] = {
              descripcion:
                item.descripcion || item.productoDescripcion || 'Producto sin descripción',
              cantidad: 0,
              monto: 0,
            };
          }
          productosVendidos[productoId].cantidad += item.cantidad;
          productosVendidos[productoId].monto +=
            item.subtotal || item.cantidad * item.precioUnitario;
        });
      });

      const topProductos = Object.entries(productosVendidos)
        .map(([productoId, data]) => ({
          productoId: parseInt(productoId),
          descripcion: data.descripcion,
          cantidad: data.cantidad,
          monto: data.monto,
        }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

      // Ventas por día
      const ventasPorDia: { [key: string]: { cantidad: number; monto: number } } = {};

      ventasCompletadas.forEach(venta => {
        const fecha = venta.fecha.toISOString().split('T')[0]; // YYYY-MM-DD
        if (!ventasPorDia[fecha]) {
          ventasPorDia[fecha] = { cantidad: 0, monto: 0 };
        }
        ventasPorDia[fecha].cantidad += 1;
        ventasPorDia[fecha].monto += venta.total;
      });

      const ventasPorDiaArray = Object.entries(ventasPorDia)
        .map(([fecha, data]) => ({
          fecha,
          cantidad: data.cantidad,
          monto: data.monto,
        }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      // Métricas de ventas anuladas
      const ventasAnuladasCount = ventasAnuladas.length;
      const montoVentasAnuladas = ventasAnuladas.reduce((sum, v) => sum + v.total, 0);

      const resultado: SalesCutoffDto = {
        fechaInicio: fechaInicio,
        fechaFin: fechaFin,
        totalVentas: MoneyUtil.round(totalVentas),
        totalCobrado: MoneyUtil.round(totalCobrado),
        totalAjusteRedondeo: MoneyUtil.round(totalAjusteRedondeo),
        numeroTransacciones,
        ticketPromedio: MoneyUtil.round(ticketPromedio),
        ticketPromedioCobrado: MoneyUtil.round(ticketPromedioCobrado),
        totalDescuentos: MoneyUtil.round(totalDescuentos),
        puntosOtorgados,
        puntosCanjeados,
        desgloseMetodosPago,
        desgloseTipoCompra,
        topProductos,
        ventasPorDia: ventasPorDiaArray,
        ventasAnuladas: ventasAnuladasCount,
        montoVentasAnuladas: MoneyUtil.round(montoVentasAnuladas),
      };

      this.logger.log(
        `✅ Corte generado: ${numeroTransacciones} ventas, S/ ${totalVentas.toFixed(2)} total`,
      );
      return resultado;
    } catch (error) {
      this.logger.error(`❌ Error generando corte de ventas: ${error.message}`);
      throw new InternalServerErrorException(`Error generando reporte: ${error.message}`);
    }
  }

  /**
   * Procesa los métodos de pago para una venta
   * Usa únicamente el formato normalizado metodosPageo
   */
  private _procesarMetodosPago(
    createVentaDto: CreateVentaDto,
    totalVenta: number,
  ): { metodoPago: MetodoPago; monto: number; referencia?: string; timestamp: Date }[] {
    const now = new Date();

    // Validar que metodosPageo esté presente
    if (!createVentaDto.metodosPageo || createVentaDto.metodosPageo.length === 0) {
      throw new BadRequestException('Debe especificar al menos un método de pago');
    }

    // Validar que la suma de montos sea igual al total
    const sumaMontos = MoneyUtil.sum(createVentaDto.metodosPageo.map(m => m.monto));
    
    const validacion = MoneyUtil.validatePayment(sumaMontos, totalVenta);
    
    if (!validacion.isValid) {
      throw new BadRequestException(
        `${validacion.mensaje}. Total venta: S/ ${totalVenta.toFixed(2)}, Suma de métodos: S/ ${sumaMontos.toFixed(2)}`
      );
    }

    return createVentaDto.metodosPageo.map(metodo => ({
      metodoPago: metodo.metodoPago,
      monto: metodo.monto,
      referencia: metodo.referencia,
      timestamp: now,
    }));
  }

  /**
   * Procesa métodos de pago normalizados para la nueva arquitectura
   * Convierte los datos del DTO en registros para la tabla venta_pagos
   */
  private async _procesarPagosNormalizados(
    createVentaDto: CreateVentaDto,
    totalVenta: number,
    cajero: string,
    queryRunner: any,
  ): Promise<CreateVentaPagoDto[]> {
    const pagosNormalizados: CreateVentaPagoDto[] = [];
    let secuencia = 1;

    // Validar que metodosPageo esté presente
    if (!createVentaDto.metodosPageo || createVentaDto.metodosPageo.length === 0) {
      throw new BadRequestException('Debe especificar al menos un método de pago');
    }

    // Procesar métodos de pago
    for (const metodo of createVentaDto.metodosPageo) {
      pagosNormalizados.push({
        metodoPago: metodo.metodoPago,
        monto: metodo.monto,
        referencia: metodo.referencia || undefined,
      });
    }

    // Validar que la suma de pagos coincida con el total
    const sumaPagos = MoneyUtil.sum(pagosNormalizados.map(p => p.monto));
    
    const validacion = MoneyUtil.validatePayment(sumaPagos, totalVenta);
    
    if (!validacion.isValid) {
      // Pago insuficiente o excesivo fuera de tolerancia
      throw new BadRequestException(
        `${validacion.mensaje}. Total venta: S/ ${totalVenta.toFixed(2)}, Pagado: S/ ${sumaPagos.toFixed(2)}`
      );
    }

    this.logger.debug(
      `✓ Pagos validados: ${pagosNormalizados.length} métodos, suma: S/ ${sumaPagos.toFixed(2)}, ${validacion.mensaje}`
    );
    return pagosNormalizados;
  }

  /**
   * Envía notificación de venta por WhatsApp de forma asíncrona
   */
  private async _enviarNotificacionWhatsApp(
    cliente: Cliente,
    venta: Venta,
    resumen: ResumenVenta,
  ): Promise<void> {
    try {
      this.logger.log(`📱 Enviando notificación WhatsApp a ${cliente.telefono}`);

      const resultado = await this.whatsappService.sendVentaNotification(
        cliente.telefono,
        venta.total,
        venta.puntosOtorgados,
        venta.ticketId,
      );

      if (resultado.success) {
        this.logger.log(
          `✅ Notificación enviada a ${cliente.telefono} - Ticket: ${venta.ticketId}`,
        );
      } else {
        this.logger.warn(`⚠️ Error enviando WhatsApp: ${resultado.error}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️ Excepción enviando WhatsApp: ${error.message}`);
    }
  }

  /**
   * Previsualiza una venta sin persistir datos
   * Calcula subtotal, promociones, puntos, redondeo y vuelto
   * Elimina lógica del frontend y centraliza cálculos
   */
  async previewVenta(
    items: Array<{ productoId: number; cantidad: number }>,
    clienteId?: number,
    puntosAUsar?: number,
    montoRecibido?: number
  ): Promise<{
    subtotal: number;
    descuentoPromos: number;
    descuentoPuntos: number;
    ajusteRedondeo: number;
    total: number;
    totalCobrado: number;
    vuelto: number;
    puntosOtorgados: number;
    detalleItems: Array<{
      productoId: number;
      nombre: string;
      precio: number;
      cantidad: number;
      subtotal: number;
    }>;
    validaciones: {
      stockSuficiente: boolean;
      puntosValidos: boolean;
      mensajes: string[];
    };
  }> {
    const validaciones = {
      stockSuficiente: true,
      puntosValidos: true,
      mensajes: [] as string[]
    };

    // 1. Validar y obtener productos
    const productosIds = items.map(item => item.productoId);
    const productos = await this.productosService.findByIds(productosIds);

    if (productos.length !== productosIds.length) {
      throw new BadRequestException('Algunos productos no fueron encontrados');
    }

    // 2. Calcular subtotal y validar stock
    let subtotal = 0;
    const detalleItems: Array<{
      productoId: number;
      nombre: string;
      precio: number;
      cantidad: number;
      subtotal: number;
    }> = [];

    for (const item of items) {
      const producto = productos.find(p => p.id === item.productoId);
      if (!producto) continue;

      // Validar stock
      if (producto.cantidadActual < item.cantidad) {
        validaciones.stockSuficiente = false;
        validaciones.mensajes.push(
          `Stock insuficiente para ${producto.productoDescripcion}. Disponible: ${producto.cantidadActual}, Requerido: ${item.cantidad}`
        );
      }

      const subtotalItem = MoneyUtil.round(producto.precio * item.cantidad);
      subtotal += subtotalItem;

      detalleItems.push({
        productoId: producto.id,
        nombre: producto.productoDescripcion,
        precio: producto.precio,
        cantidad: item.cantidad,
        subtotal: subtotalItem,
      });
    }

    subtotal = MoneyUtil.round(subtotal);

    // 3. Aplicar promociones (TODO: implementar cuando exista PromocionesService)
    const descuentoPromos = 0;

    // 4. Aplicar descuento por puntos
    let descuentoPuntos = 0;
    let puntosFinales = 0;

    if (clienteId && puntosAUsar && puntosAUsar > 0) {
      try {
        // Usar PuntosService para validar puntos (si está disponible)
        const VALOR_PUNTO = 0.10;
        
        // Validación básica de límite (50% del subtotal)
        const limitePuntos = Math.floor((subtotal * 0.5) / VALOR_PUNTO);
        puntosFinales = Math.min(puntosAUsar, limitePuntos);
        
        descuentoPuntos = MoneyUtil.round(puntosFinales * VALOR_PUNTO);
        
        if (puntosFinales < puntosAUsar) {
          validaciones.puntosValidos = false;
          validaciones.mensajes.push(
            `Solo se pueden usar ${puntosFinales} puntos para estos productos (máximo 50% del valor)`
          );
        }
      } catch (error) {
        validaciones.puntosValidos = false;
        validaciones.mensajes.push(`Error validando puntos: ${error.message}`);
      }
    }

    // 5. Calcular total después de descuentos
    const totalDespuesDescuentos = MoneyUtil.round(subtotal - descuentoPromos - descuentoPuntos);

    // 6. Calcular ajuste de redondeo y total cobrado
    const ajusteRedondeo = MoneyUtil.calculateRoundingAdjustment(totalDespuesDescuentos, totalDespuesDescuentos);
    const totalCobrado = MoneyUtil.round(totalDespuesDescuentos + ajusteRedondeo);

    // 7. Calcular vuelto
    const vuelto = montoRecibido ? MoneyUtil.round(montoRecibido - totalCobrado) : 0;

    // 8. Calcular puntos otorgados (1 punto por cada S/ 10)
    const puntosOtorgados = Math.floor(totalCobrado / 10);

    return {
      subtotal,
      descuentoPromos,
      descuentoPuntos,
      ajusteRedondeo,
      total: totalDespuesDescuentos,
      totalCobrado,
      vuelto,
      puntosOtorgados,
      detalleItems,
      validaciones,
    };
  }
}

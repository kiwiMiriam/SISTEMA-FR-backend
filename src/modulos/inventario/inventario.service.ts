import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { Producto } from '../../entities/producto.entity';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity';
import { TipoMovimiento } from '../../common/enums';

/**
 * Servicio para gestión automática de inventario
 * Maneja descuentos de stock post-venta con transacciones atómicas
 */
@Injectable()
export class InventarioService {
  private readonly logger = new Logger(InventarioService.name);

  constructor(
    @InjectRepository(Producto)
    private productoRepository: Repository<Producto>,
    @InjectRepository(MovimientoInventario)
    private movimientoRepository: Repository<MovimientoInventario>,
  ) {}

  /**
   * Descuenta stock automáticamente después de una venta
   * Debe ejecutarse dentro de una transacción para garantizar atomicidad
   * @param items Lista de productos vendidos
   * @param ventaId ID de la venta
   * @param cajero Usuario que realizó la venta
   * @param queryRunner QueryRunner de la transacción activa
   */
  async descontarStockPostVenta(
    items: Array<{ productoId: number; cantidad: number; descripcion: string }>,
    ventaId: number,
    cajero: string,
    queryRunner: QueryRunner
  ): Promise<void> {
    this.logger.debug(`🔄 Iniciando descuento de stock para venta #${ventaId}`);

    for (const item of items) {
      try {
        // Buscar producto dentro de la transacción
        const producto = await queryRunner.manager.findOne(Producto, {
          where: { id: item.productoId }
        });

        if (!producto) {
          throw new BadRequestException(`Producto con ID ${item.productoId} no encontrado`);
        }

        // Validar stock suficiente
        if (producto.cantidadActual < item.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente para ${producto.productoDescripcion}. Disponible: ${producto.cantidadActual}, Requerido: ${item.cantidad}`
          );
        }

        // Calcular nuevo stock
        const nuevoStock = producto.cantidadActual - item.cantidad;

        // Actualizar stock del producto
        await queryRunner.manager.update(Producto, producto.id, {
          cantidadActual: nuevoStock,
          fechaActualizacion: new Date()
        });

        // Registrar movimiento de inventario
        const movimiento = this.movimientoRepository.create({
          codigoBarra: producto.codigoBarra,
          descripcion: producto.productoDescripcion,
          costo: producto.costo,
          precioVenta: producto.precio,
          existenciaAnterior: producto.cantidadActual,
          existenciaNueva: nuevoStock,
          existencia: nuevoStock,
          invMinimo: producto.cantidadMinima,
          tipo: TipoMovimiento.SALIDA,
          cantidad: item.cantidad,
          cajero: cajero,
          observaciones: `Venta #${ventaId}`,
          ventaId: ventaId,
          hora: new Date()
        });

        await queryRunner.manager.save(movimiento);

        this.logger.debug(
          `✓ Stock actualizado: ${producto.productoDescripcion} | ${producto.cantidadActual} → ${nuevoStock} (-${item.cantidad})`
        );

      } catch (error) {
        this.logger.error(
          `❌ Error descontando stock de ${item.descripcion}: ${error.message}`
        );
        throw error; // Re-lanzar para que la transacción haga rollback
      }
    }

    this.logger.log(`✅ Stock descontado exitosamente para ${items.length} productos`);
  }

  /**
   * Revierte descuentos de stock por anulación de venta
   * @param ventaId ID de la venta anulada
   * @param cajero Usuario que anula
   * @param queryRunner QueryRunner de la transacción activa
   */
  async revertirStockPorAnulacion(
    ventaId: number,
    cajero: string,
    queryRunner: QueryRunner
  ): Promise<void> {
    this.logger.debug(`🔄 Revirtiendo stock por anulación de venta #${ventaId}`);

    // Buscar movimientos de salida de la venta
    const movimientos = await queryRunner.manager.find(MovimientoInventario, {
      where: { 
        ventaId: ventaId,
        tipo: TipoMovimiento.SALIDA
      }
    });

    for (const movimiento of movimientos) {
      try {
        // Buscar producto por código de barra
        const producto = await queryRunner.manager.findOne(Producto, {
          where: { codigoBarra: movimiento.codigoBarra }
        });

        if (!producto) {
          throw new BadRequestException(`Producto con código ${movimiento.codigoBarra} no encontrado`);
        }

        const cantidadARevertir = movimiento.cantidad;
        const nuevoStock = producto.cantidadActual + cantidadARevertir;

        // Actualizar stock del producto
        await queryRunner.manager.update(Producto, producto.id, {
          cantidadActual: nuevoStock,
          fechaActualizacion: new Date()
        });

        // Registrar movimiento de entrada (reverso)
        const movimientoReverso = this.movimientoRepository.create({
          codigoBarra: producto.codigoBarra,
          descripcion: producto.productoDescripcion,
          costo: producto.costo,
          precioVenta: producto.precio,
          existenciaAnterior: producto.cantidadActual,
          existenciaNueva: nuevoStock,
          existencia: nuevoStock,
          invMinimo: producto.cantidadMinima,
          tipo: TipoMovimiento.ENTRADA,
          cantidad: cantidadARevertir,
          cajero: cajero,
          observaciones: `Anulación venta #${ventaId}`,
          ventaId: ventaId,
          hora: new Date()
        });

        await queryRunner.manager.save(movimientoReverso);

        this.logger.debug(
          `✓ Stock revertido: ${producto.productoDescripcion} | ${producto.cantidadActual} → ${nuevoStock} (+${cantidadARevertir})`
        );

      } catch (error) {
        this.logger.error(
          `❌ Error revirtiendo stock de ${movimiento.descripcion}: ${error.message}`
        );
        throw error;
      }
    }

    this.logger.log(`✅ Stock revertido exitosamente para venta #${ventaId}`);
  }

  /**
   * Consulta movimientos de inventario por código de barra
   * @param codigoBarra Código de barra del producto
   * @param limit Límite de resultados
   * @returns Lista de movimientos
   */
  async consultarMovimientosPorProducto(
    codigoBarra: string,
    limit: number = 50
  ): Promise<MovimientoInventario[]> {
    return await this.movimientoRepository.find({
      where: { codigoBarra },
      order: { hora: 'DESC' },
      take: limit
    });
  }

  /**
   * Consulta movimientos de inventario por venta
   * @param ventaId ID de la venta
   * @returns Lista de movimientos
   */
  async consultarMovimientosPorVenta(ventaId: number): Promise<MovimientoInventario[]> {
    return await this.movimientoRepository.find({
      where: { ventaId },
      order: { hora: 'ASC' }
    });
  }
}

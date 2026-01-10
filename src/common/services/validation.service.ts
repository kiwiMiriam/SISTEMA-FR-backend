import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto } from '../../entities/producto.entity';
import { Cliente } from '../../entities/cliente.entity';
import { Venta } from '../../entities/venta.entity';
import { EstadoVenta } from '../enums';

/**
 * Servicio centralizado para validaciones contables estrictas
 * Previene inconsistencias y garantiza integridad de datos
 */
@Injectable()
export class ValidationService {
  constructor(
    @InjectRepository(Producto)
    private productoRepository: Repository<Producto>,
    @InjectRepository(Cliente)
    private clienteRepository: Repository<Cliente>,
    @InjectRepository(Venta)
    private ventaRepository: Repository<Venta>,
  ) {}

  /**
   * Valida que no se genere stock negativo
   * @param productoId ID del producto
   * @param cantidadRequerida Cantidad que se quiere descontar
   * @throws BadRequestException si no hay stock suficiente
   */
  async validarStockSuficiente(productoId: number, cantidadRequerida: number): Promise<void> {
    const producto = await this.productoRepository.findOne({
      where: { id: productoId }
    });

    if (!producto) {
      throw new BadRequestException(`Producto con ID ${productoId} no encontrado`);
    }

    if (producto.cantidadActual < cantidadRequerida) {
      throw new BadRequestException(
        `Stock insuficiente para ${producto.productoDescripcion}. Disponible: ${producto.cantidadActual}, Requerido: ${cantidadRequerida}`
      );
    }
  }

  /**
   * Valida múltiples productos de una vez
   * @param items Array de items con productoId y cantidad
   */
  async validarStockMultiple(items: Array<{ productoId: number; cantidad: number }>): Promise<void> {
    for (const item of items) {
      await this.validarStockSuficiente(item.productoId, item.cantidad);
    }
  }

  /**
   * Valida que el cliente tenga puntos suficientes
   * @param clienteId ID del cliente
   * @param puntosRequeridos Puntos que se quieren usar
   * @throws BadRequestException si no tiene puntos suficientes
   */
  async validarPuntosSuficientes(clienteId: number, puntosRequeridos: number): Promise<void> {
    if (puntosRequeridos <= 0) return;

    const cliente = await this.clienteRepository.findOne({
      where: { id: clienteId }
    });

    if (!cliente) {
      throw new BadRequestException(`Cliente con ID ${clienteId} no encontrado`);
    }

    if (cliente.puntosAcumulados < puntosRequeridos) {
      throw new BadRequestException(
        `Puntos insuficientes. Disponibles: ${cliente.puntosAcumulados}, Requeridos: ${puntosRequeridos}`
      );
    }
  }

  /**
   * Valida que una venta no esté cerrada/completada
   * @param ventaId ID de la venta
   * @throws BadRequestException si la venta está cerrada
   */
  async validarVentaEditable(ventaId: number): Promise<void> {
    const venta = await this.ventaRepository.findOne({
      where: { id: ventaId }
    });

    if (!venta) {
      throw new BadRequestException(`Venta con ID ${ventaId} no encontrada`);
    }

    if (venta.estado === EstadoVenta.COMPLETADO) {
      throw new BadRequestException('No se puede modificar una venta completada');
    }

    if (venta.estado === EstadoVenta.ANULADO) {
      throw new BadRequestException('No se puede modificar una venta anulada');
    }
  }

  /**
   * Valida que una venta no se pueda eliminar si está confirmada
   * @param ventaId ID de la venta
   * @throws BadRequestException si la venta no se puede eliminar
   */
  async validarVentaEliminable(ventaId: number): Promise<void> {
    const venta = await this.ventaRepository.findOne({
      where: { id: ventaId }
    });

    if (!venta) {
      throw new BadRequestException(`Venta con ID ${ventaId} no encontrada`);
    }

    if (venta.estado === EstadoVenta.COMPLETADO) {
      throw new BadRequestException('No se puede eliminar una venta completada');
    }
  }

  /**
   * Valida límites de puntos por productos (máximo 50% del valor)
   * @param items Items de la venta
   * @param puntosAUsar Puntos que se quieren usar
   * @throws BadRequestException si excede el límite
   */
  async validarLimitePuntosPorProductos(
    items: Array<{ productoId: number; cantidad: number }>,
    puntosAUsar: number
  ): Promise<void> {
    if (puntosAUsar <= 0) return;

    const VALOR_PUNTO = 0.10; // S/ 0.10 por punto
    const productosIds = items.map(item => item.productoId);
    const productos = await this.productoRepository.findByIds(productosIds);

    let limiteTotal = 0;
    for (const item of items) {
      const producto = productos.find(p => p.id === item.productoId);
      if (!producto) continue;

      const subtotal = producto.precio * item.cantidad;
      const limitePorProducto = Math.floor((subtotal * 0.5) / VALOR_PUNTO);
      limiteTotal += limitePorProducto;
    }

    if (puntosAUsar > limiteTotal) {
      throw new BadRequestException(
        `Solo se pueden usar ${limiteTotal} puntos para estos productos (máximo 50% del valor)`
      );
    }
  }

  /**
   * Valida que los montos sean positivos y coherentes
   * @param total Total de la venta
   * @param montoRecibido Monto recibido del cliente
   * @throws BadRequestException si los montos son inválidos
   */
  async validarMontosCoherentes(total: number, montoRecibido: number): Promise<void> {
    if (total <= 0) {
      throw new BadRequestException('El total de la venta debe ser mayor a 0');
    }

    if (montoRecibido < 0) {
      throw new BadRequestException('El monto recibido no puede ser negativo');
    }

    // Permitir diferencias pequeñas por redondeo (hasta 1 sol)
    const diferencia = Math.abs(montoRecibido - total);
    if (diferencia > 1.00) {
      throw new BadRequestException(
        `Diferencia muy grande entre total (${total}) y monto recibido (${montoRecibido})`
      );
    }
  }

  /**
   * Valida que un producto exista y esté activo
   * @param productoId ID del producto
   * @throws BadRequestException si el producto no existe o está inactivo
   */
  async validarProductoActivo(productoId: number): Promise<Producto> {
    const producto = await this.productoRepository.findOne({
      where: { id: productoId }
    });

    if (!producto) {
      throw new BadRequestException(`Producto con ID ${productoId} no encontrado`);
    }

    // Si hay campo activo en el futuro
    // if (!producto.activo) {
    //   throw new BadRequestException(`Producto ${producto.nombre} está inactivo`);
    // }

    return producto;
  }

  /**
   * Valida que un cliente exista y esté activo
   * @param clienteId ID del cliente
   * @throws BadRequestException si el cliente no existe
   */
  async validarClienteActivo(clienteId: number): Promise<Cliente> {
    const cliente = await this.clienteRepository.findOne({
      where: { id: clienteId }
    });

    if (!cliente) {
      throw new BadRequestException(`Cliente con ID ${clienteId} no encontrado`);
    }

    return cliente;
  }
}

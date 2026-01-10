// Enums centralizados para todo el proyecto

export enum EstadoDelivery {
  PENDIENTE = 'PENDIENTE',
  ASIGNADO = 'ASIGNADO',
  EN_CAMINO = 'EN_CAMINO',
  ENTREGADO = 'ENTREGADO',
  CANCELADO = 'CANCELADO'
}

// Importar nuevos enums del modelo unificado
export { TipoPromocion } from './tipo-promocion.enum';
export { TipoDescuento } from './tipo-descuento.enum';

export enum UserRole {
  ADMIN = 'ADMIN',
  CAJERO = 'CAJERO',
  INVENTARIOS = 'INVENTARIOS'
}

export enum EstadoVenta {
  COMPLETADO = 'COMPLETADO',
  ANULADO = 'ANULADO',
  PENDIENTE = 'PENDIENTE'
}

export enum TipoCompra {
  LOCAL = 'LOCAL',
  DELIVERY = 'DELIVERY'
}

export enum MetodoPago {
  EFECTIVO = 'EFECTIVO',
  YAPE = 'YAPE',
  PLIN = 'PLIN',
  TARJETA = 'TARJETA',
  CANJE_PUNTOS = 'CANJE_PUNTOS'
}

export enum EstadoCaja {
  ABIERTA = 'ABIERTA',
  CERRADA = 'CERRADA'
}

export enum CategoriaGasto {
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  OPERATIVO = 'OPERATIVO',
  MARKETING = 'MARKETING',
  MANTENIMIENTO = 'MANTENIMIENTO',
  SERVICIOS = 'SERVICIOS',
  OTROS = 'OTROS'
}

export enum TipoMovimiento {
  ENTRADA = 'ENTRADA',
  SALIDA = 'SALIDA',
  AJUSTE = 'AJUSTE',
  VENTA = 'VENTA',
  DEVOLUCION = 'DEVOLUCION'
}

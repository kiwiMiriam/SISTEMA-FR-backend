import { SetMetadata } from '@nestjs/common';

/**
 * Decorador para aplicar validaciones automáticas en endpoints
 * Uso: @ValidateContable(['stock', 'puntos', 'montos'])
 */
export const ValidateContable = (...validations: string[]) => SetMetadata('validations', validations);

/**
 * Decoradores específicos para validaciones comunes
 */
export const ValidateStock = () => ValidateContable('stock');
export const ValidatePuntos = () => ValidateContable('puntos');
export const ValidateMontos = () => ValidateContable('montos');
export const ValidateVentaEditable = () => ValidateContable('venta-editable');
export const ValidateVentaEliminable = () => ValidateContable('venta-eliminable');
export const ValidateLimitePuntos = () => ValidateContable('limite-puntos');

/**
 * Decorador combinado para validaciones de venta completa
 */
export const ValidateVentaCompleta = () => ValidateContable('stock', 'puntos', 'montos', 'limite-puntos');

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ValidationService } from '../services/validation.service';

/**
 * Guard para validaciones automáticas en endpoints críticos
 * Usa metadatos para determinar qué validaciones aplicar
 */
@Injectable()
export class ValidationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private validationService: ValidationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const validations = this.reflector.get<string[]>('validations', context.getHandler());

    if (!validations || validations.length === 0) {
      return true;
    }

    // Aplicar validaciones según metadatos
    for (const validation of validations) {
      await this.applyValidation(validation, request);
    }

    return true;
  }

  private async applyValidation(validation: string, request: any): Promise<void> {
    const body = request.body;
    const params = request.params;

    switch (validation) {
      case 'stock':
        if (body.items) {
          await this.validationService.validarStockMultiple(body.items);
        }
        break;

      case 'puntos':
        if (body.clienteId && body.puntosAUsar) {
          await this.validationService.validarPuntosSuficientes(body.clienteId, body.puntosAUsar);
        }
        break;

      case 'venta-editable':
        if (params.id) {
          await this.validationService.validarVentaEditable(parseInt(params.id));
        }
        break;

      case 'venta-eliminable':
        if (params.id) {
          await this.validationService.validarVentaEliminable(parseInt(params.id));
        }
        break;

      case 'montos':
        if (body.total && body.montoRecibido !== undefined) {
          await this.validationService.validarMontosCoherentes(body.total, body.montoRecibido);
        }
        break;

      case 'limite-puntos':
        if (body.items && body.puntosAUsar) {
          await this.validationService.validarLimitePuntosPorProductos(body.items, body.puntosAUsar);
        }
        break;

      default:
        // Validación no reconocida, continuar
        break;
    }
  }
}

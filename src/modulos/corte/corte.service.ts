import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Venta } from '../../entities/venta.entity';
import { EstadoVenta } from '../../common/enums';
import { Gasto } from '../../entities/gasto.entity';
import { EntradasService } from '../entradas/entradas.service';
import { MoneyUtil } from '../../common/utils/money.util';

export interface ResumenCorte {
  periodo: {
    fechaInicio: string;
    fechaFin: string;
  };
  ventas: {
    cantidad: number;
    totalBruto: number;
    totalCobrado: number;
    ajustesRedondeo: number;
    desglosePorMetodo: Record<string, number>;
  };
  entradas: {
    cantidad: number;
    total: number;
    porCategoria: Record<string, number>;
  };
  gastos: {
    cantidad: number;
    total: number;
    porCategoria: Record<string, number>;
  };
  rentabilidad: {
    ingresosTotales: number;
    gastosTotales: number;
    utilidadNeta: number;
    margenUtilidad: number;
  };
}

/**
 * Servicio dedicado para cálculos de corte de caja con contabilidad real
 * Fórmula: rentabilidad = (ventas + entradas) - gastos
 */
@Injectable()
export class CorteService {
  constructor(
    @InjectRepository(Venta)
    private ventaRepository: Repository<Venta>,
    @InjectRepository(Gasto)
    private gastoRepository: Repository<Gasto>,
    private entradasService: EntradasService,
  ) {}

  /**
   * Calcula el corte de caja completo con contabilidad real
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Resumen completo del corte
   */
  async calcularCorteCompleto(fechaInicio: Date, fechaFin: Date): Promise<ResumenCorte> {
    // Obtener ventas del período
    const ventas = await this.ventaRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
        estado: EstadoVenta.COMPLETADO,
      },
      relations: ['pagos'],
    });

    // Obtener entradas del período
    const entradas = await this.entradasService.findByDateRange(fechaInicio, fechaFin);

    // Obtener gastos del período
    const gastos = await this.gastoRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
      },
    });

    // Calcular totales de ventas
    const resumenVentas = this.calcularResumenVentas(ventas);
    
    // Calcular totales de entradas
    const resumenEntradas = this.calcularResumenEntradas(entradas);
    
    // Calcular totales de gastos
    const resumenGastos = this.calcularResumenGastos(gastos);

    // Calcular rentabilidad real
    const ingresosTotales = MoneyUtil.sum([resumenVentas.totalCobrado, resumenEntradas.total]);
    const gastosTotales = resumenGastos.total;
    const utilidadNeta = MoneyUtil.round(ingresosTotales - gastosTotales);
    const margenUtilidad = ingresosTotales > 0 ? MoneyUtil.round((utilidadNeta / ingresosTotales) * 100) : 0;

    return {
      periodo: {
        fechaInicio: fechaInicio.toISOString().split('T')[0],
        fechaFin: fechaFin.toISOString().split('T')[0],
      },
      ventas: resumenVentas,
      entradas: resumenEntradas,
      gastos: resumenGastos,
      rentabilidad: {
        ingresosTotales,
        gastosTotales,
        utilidadNeta,
        margenUtilidad,
      },
    };
  }

  /**
   * Calcula resumen de ventas incluyendo ajustes de redondeo
   * @param ventas Lista de ventas
   * @returns Resumen de ventas
   */
  private calcularResumenVentas(ventas: Venta[]) {
    const cantidad = ventas.length;
    
    // Total bruto (suma de totales teóricos)
    const totalBruto = MoneyUtil.sum(ventas.map(v => v.total));
    
    // Total cobrado (incluye ajustes de redondeo)
    const totalCobrado = MoneyUtil.sum(ventas.map(v => v.total + (v.ajusteRedondeo || 0)));
    
    // Total de ajustes de redondeo
    const ajustesRedondeo = MoneyUtil.sum(ventas.map(v => v.ajusteRedondeo || 0));

    // Desglose por método de pago
    const desglosePorMetodo: Record<string, number> = {};
    
    ventas.forEach(venta => {
      if (venta.pagos && venta.pagos.length > 0) {
        venta.pagos.forEach(pago => {
          const metodo = pago.metodoPago;
          if (!desglosePorMetodo[metodo]) {
            desglosePorMetodo[metodo] = 0;
          }
          desglosePorMetodo[metodo] = MoneyUtil.sum([desglosePorMetodo[metodo], pago.monto]);
        });
      } else {
        // Si no hay pagos registrados, asumir efectivo por el total cobrado
        const metodo = 'EFECTIVO';
        if (!desglosePorMetodo[metodo]) {
          desglosePorMetodo[metodo] = 0;
        }
        desglosePorMetodo[metodo] = MoneyUtil.sum([
          desglosePorMetodo[metodo], 
          venta.total + (venta.ajusteRedondeo || 0)
        ]);
      }
    });

    return {
      cantidad,
      totalBruto,
      totalCobrado,
      ajustesRedondeo,
      desglosePorMetodo,
    };
  }

  /**
   * Calcula resumen de entradas
   * @param entradas Lista de entradas
   * @returns Resumen de entradas
   */
  private calcularResumenEntradas(entradas: any[]) {
    const cantidad = entradas.length;
    const total = MoneyUtil.sum(entradas.map(e => e.monto));

    // Agrupar por categoría
    const porCategoria: Record<string, number> = {};
    entradas.forEach(entrada => {
      const categoria = entrada.categoria || 'SIN_CATEGORIA';
      if (!porCategoria[categoria]) {
        porCategoria[categoria] = 0;
      }
      porCategoria[categoria] = MoneyUtil.sum([porCategoria[categoria], entrada.monto]);
    });

    return {
      cantidad,
      total,
      porCategoria,
    };
  }

  /**
   * Calcula resumen de gastos
   * @param gastos Lista de gastos
   * @returns Resumen de gastos
   */
  private calcularResumenGastos(gastos: Gasto[]) {
    const cantidad = gastos.length;
    const total = MoneyUtil.sum(gastos.map(g => g.monto));

    // Agrupar por categoría
    const porCategoria: Record<string, number> = {};
    gastos.forEach(gasto => {
      const categoria = gasto.categoria || 'SIN_CATEGORIA';
      if (!porCategoria[categoria]) {
        porCategoria[categoria] = 0;
      }
      porCategoria[categoria] = MoneyUtil.sum([porCategoria[categoria], gasto.monto]);
    });

    return {
      cantidad,
      total,
      porCategoria,
    };
  }

  /**
   * Obtiene estadísticas rápidas para dashboard
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Estadísticas resumidas
   */
  async obtenerEstadisticasRapidas(fechaInicio: Date, fechaFin: Date) {
    const [
      totalVentas,
      totalEntradas,
      totalGastos,
      cantidadVentas,
    ] = await Promise.all([
      this.ventaRepository
        .createQueryBuilder('venta')
        .select('SUM(venta.total + COALESCE(venta.ajusteRedondeo, 0))', 'total')
        .where('venta.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
        .andWhere('venta.estado = :estado', { estado: EstadoVenta.COMPLETADO })
        .getRawOne(),
      
      this.entradasService.calcularTotalPorRango(fechaInicio, fechaFin),
      
      this.gastoRepository
        .createQueryBuilder('gasto')
        .select('SUM(gasto.monto)', 'total')
        .where('gasto.fecha BETWEEN :fechaInicio AND :fechaFin', { fechaInicio, fechaFin })
        .getRawOne(),
      
      this.ventaRepository.count({
        where: {
          fecha: Between(fechaInicio, fechaFin),
          estado: EstadoVenta.COMPLETADO,
        },
      }),
    ]);

    const ingresosTotales = MoneyUtil.sum([
      parseFloat(totalVentas.total) || 0,
      totalEntradas,
    ]);
    
    const gastosTotales = parseFloat(totalGastos.total) || 0;
    const utilidadNeta = MoneyUtil.round(ingresosTotales - gastosTotales);

    return {
      ingresosTotales: MoneyUtil.round(ingresosTotales),
      gastosTotales: MoneyUtil.round(gastosTotales),
      utilidadNeta,
      cantidadVentas,
      promedioVenta: cantidadVentas > 0 ? MoneyUtil.round(ingresosTotales / cantidadVentas) : 0,
    };
  }
}

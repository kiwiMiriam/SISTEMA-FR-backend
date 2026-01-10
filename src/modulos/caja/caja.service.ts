import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Caja, EstadoCaja } from '../../entities/caja.entity';
import { Venta } from '../../entities/venta.entity';
import { EstadoVenta } from '../../common/enums';
import { Gasto } from '../../entities/gasto.entity';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';

@Injectable()
export class CajaService {
  constructor(
    @InjectRepository(Caja)
    private cajaRepository: Repository<Caja>,
    @InjectRepository(Venta)
    private ventaRepository: Repository<Venta>,
    @InjectRepository(Gasto)
    private gastoRepository: Repository<Gasto>,
  ) {}

  async abrirCaja(abrirCajaDto: AbrirCajaDto, cajero: string): Promise<Caja> {
    // Verificar que no haya una caja abierta
    const cajaAbierta = await this.getCajaAbierta(cajero);
    if (cajaAbierta) {
      throw new BadRequestException('Ya existe una caja abierta para este cajero');
    }

    // Crear objeto Caja con inicialización explícita de campos NOT NULL
    // ANTES del spread del DTO para evitar sobrescritura con undefined
    const caja = this.cajaRepository.create({
      // Campos obligatorios inicializados PRIMERO
      totalVentas: 0,
      totalGastos: 0,
      montoFinal: 0,
      diferencia: 0,
      desglosePorMetodo: {},
      estado: EstadoCaja.ABIERTA,
      fechaApertura: new Date(),
      cajero,
      // Campos del DTO al final para permitir sobrescritura segura
      ...abrirCajaDto,
    });

    return this.cajaRepository.save(caja);
  }

  async cerrarCaja(id: number, cerrarCajaDto: CerrarCajaDto): Promise<Caja> {
    const caja = await this.findById(id);

    if (caja.estado === EstadoCaja.CERRADA) {
      throw new BadRequestException('La caja ya está cerrada');
    }

    // Calcular totales del día
    const { totalVentas, totalGastos, desglosePorMetodo } = await this.calcularTotalesCaja(caja);

    const montoEsperado = caja.montoInicial + totalVentas - totalGastos;
    const diferencia = cerrarCajaDto.montoFinal - montoEsperado;

    await this.cajaRepository.update(id, {
      fechaCierre: new Date(),
      totalVentas,
      totalGastos,
      montoFinal: cerrarCajaDto.montoFinal,
      diferencia,
      desglosePorMetodo,
      observaciones: cerrarCajaDto.observaciones,
      estado: EstadoCaja.CERRADA,
    });

    return this.findById(id);
  }

  async findAll(): Promise<Caja[]> {
    return this.cajaRepository.find({
      order: { fechaApertura: 'DESC' },
    });
  }

  async findById(id: number): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({ where: { id } });
    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }
    return caja;
  }

  async getCajaAbierta(cajero?: string): Promise<Caja | null> {
    const whereCondition: any = { estado: EstadoCaja.ABIERTA };
    if (cajero) {
      whereCondition.cajero = cajero;
    }

    return this.cajaRepository.findOne({ where: whereCondition });
  }

  async getCajaActual(cajero: string): Promise<Caja> {
    const caja = await this.getCajaAbierta(cajero);
    if (!caja) {
      throw new NotFoundException('No hay una caja abierta para este cajero');
    }
    return caja;
  }

  /**
   * Obtiene el estado actual de la caja para eliminar lógica del frontend
   * @param cajero Usuario cajero
   * @returns Estado de caja con información completa
   */
  async obtenerEstadoCaja(cajero: string): Promise<{
    abierta: boolean;
    cajaId?: number;
    usuario?: string;
    fechaApertura?: Date;
    montoInicial?: number;
    totalVentas?: number;
    totalGastos?: number;
    montoEsperado?: number;
  }> {
    try {
      const caja = await this.getCajaAbierta(cajero);
      
      if (!caja) {
        return { abierta: false };
      }

      const { totalVentas, totalGastos } = await this.calcularTotalesCaja(caja);
      const montoEsperado = caja.montoInicial + totalVentas - totalGastos;

      return {
        abierta: true,
        cajaId: caja.id,
        usuario: caja.cajero,
        fechaApertura: caja.fechaApertura,
        montoInicial: caja.montoInicial,
        totalVentas,
        totalGastos,
        montoEsperado,
      };
    } catch (error) {
      // En caso de error, retornar estado cerrado para seguridad
      return { abierta: false };
    }
  }

  async getResumenCajaActual(cajero: string): Promise<any> {
    const caja = await this.getCajaActual(cajero);
    const { totalVentas, totalGastos, desglosePorMetodo } = await this.calcularTotalesCaja(caja);

    const montoEsperado = caja.montoInicial + totalVentas - totalGastos;

    return {
      caja,
      montoInicial: caja.montoInicial,
      totalVentas,
      totalGastos,
      montoEsperado,
      desglosePorMetodo,
    };
  }

  private async calcularTotalesCaja(caja: Caja): Promise<{
    totalVentas: number;
    totalGastos: number;
    desglosePorMetodo: any;
  }> {
    const fechaInicio = caja.fechaApertura;
    const fechaFin = caja.fechaCierre || new Date();

    // Calcular ventas con relación a pagos
    const ventas = await this.ventaRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
        cajero: caja.cajero,
        estado: EstadoVenta.COMPLETADO,
      },
      relations: ['pagos'],
    });

    // Calcular total cobrado (incluye ajuste de redondeo)
    const totalVentas = ventas.reduce((sum, venta) => sum + (venta.total + (venta.ajusteRedondeo || 0)), 0);

    // Desglose por método de pago usando la tabla venta_pagos
    const desglosePorMetodo = {};
    ventas.forEach(venta => {
      if (venta.pagos && venta.pagos.length > 0) {
        venta.pagos.forEach(pago => {
          desglosePorMetodo[pago.metodoPago] = (desglosePorMetodo[pago.metodoPago] || 0) + pago.monto;
        });
      }
    });

    // Calcular gastos
    const gastos = await this.gastoRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
        cajero: caja.cajero,
      },
    });

    const totalGastos = gastos.reduce((sum, gasto) => sum + gasto.monto, 0);

    return {
      totalVentas,
      totalGastos,
      desglosePorMetodo,
    };
  }

  async getCajasPorFecha(fechaInicio: Date, fechaFin: Date): Promise<Caja[]> {
    return this.cajaRepository.find({
      where: {
        fechaApertura: Between(fechaInicio, fechaFin),
      },
      order: { fechaApertura: 'DESC' },
    });
  }

  async getEstadisticasCajas(fechaInicio: Date, fechaFin: Date): Promise<any> {
    const cajas = await this.getCajasPorFecha(fechaInicio, fechaFin);

    const totalCajas = cajas.length;
    const cajasAbiertas = cajas.filter(c => c.estado === EstadoCaja.ABIERTA).length;
    const cajasCerradas = cajas.filter(c => c.estado === EstadoCaja.CERRADA).length;

    const totalVentas = cajas.reduce((sum, caja) => sum + (caja.totalVentas || 0), 0);
    const totalGastos = cajas.reduce((sum, caja) => sum + (caja.totalGastos || 0), 0);
    const totalDiferencias = cajas.reduce((sum, caja) => sum + (caja.diferencia || 0), 0);

    return {
      totalCajas,
      cajasAbiertas,
      cajasCerradas,
      totalVentas,
      totalGastos,
      totalDiferencias,
      promedioVentasPorCaja: totalCajas > 0 ? totalVentas / totalCajas : 0,
    };
  }
}

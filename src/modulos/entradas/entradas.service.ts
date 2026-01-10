import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Entrada } from '../../entities/entrada.entity';
import { CreateEntradaDto } from './dto/create-entrada.dto';
import { UpdateEntradaDto } from './dto/update-entrada.dto';
import { MoneyUtil } from '../../common/utils/money.util';

/**
 * Servicio para gestión de entradas (ingresos no relacionados con ventas)
 */
@Injectable()
export class EntradasService {
  constructor(
    @InjectRepository(Entrada)
    private entradaRepository: Repository<Entrada>,
  ) {}

  /**
   * Crear una nueva entrada
   * @param createEntradaDto Datos de la entrada
   * @param registradoPor Usuario que registra
   * @returns Entrada creada
   */
  async create(createEntradaDto: CreateEntradaDto, registradoPor: string): Promise<Entrada> {
    // Validar monto positivo
    if (createEntradaDto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const entrada = this.entradaRepository.create({
      ...createEntradaDto,
      monto: MoneyUtil.round(createEntradaDto.monto),
      registradoPor,
      fecha: createEntradaDto.fecha || new Date(),
    });

    return await this.entradaRepository.save(entrada);
  }

  /**
   * Obtener todas las entradas con paginación
   * @param page Página
   * @param limit Límite por página
   * @returns Entradas paginadas
   */
  async findAll(page: number = 1, limit: number = 10) {
    const [entradas, total] = await this.entradaRepository.findAndCount({
      order: { fecha: 'DESC', fechaCreacion: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalMonto = await this.entradaRepository
      .createQueryBuilder('entrada')
      .select('SUM(entrada.monto)', 'total')
      .getRawOne();

    return {
      entradas,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      resumen: {
        totalMonto: MoneyUtil.round(parseFloat(totalMonto.total) || 0),
        totalEntradas: total,
      }
    };
  }

  /**
   * Obtener entradas por rango de fechas
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Entradas en el rango
   */
  async findByDateRange(fechaInicio: Date, fechaFin: Date): Promise<Entrada[]> {
    return await this.entradaRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
      },
      order: { fecha: 'DESC', fechaCreacion: 'DESC' },
    });
  }

  /**
   * Calcular total de entradas por rango de fechas
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Total de entradas
   */
  async calcularTotalPorRango(fechaInicio: Date, fechaFin: Date): Promise<number> {
    const result = await this.entradaRepository
      .createQueryBuilder('entrada')
      .select('SUM(entrada.monto)', 'total')
      .where('entrada.fecha BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio,
        fechaFin,
      })
      .getRawOne();

    return MoneyUtil.round(parseFloat(result.total) || 0);
  }

  /**
   * Obtener una entrada por ID
   * @param id ID de la entrada
   * @returns Entrada encontrada
   */
  async findOne(id: number): Promise<Entrada> {
    const entrada = await this.entradaRepository.findOne({
      where: { id },
    });

    if (!entrada) {
      throw new NotFoundException(`Entrada con ID ${id} no encontrada`);
    }

    return entrada;
  }

  /**
   * Actualizar una entrada
   * @param id ID de la entrada
   * @param updateEntradaDto Datos a actualizar
   * @returns Entrada actualizada
   */
  async update(id: number, updateEntradaDto: UpdateEntradaDto): Promise<Entrada> {
    const entrada = await this.findOne(id);

    // Validar monto si se está actualizando
    if (updateEntradaDto.monto !== undefined && updateEntradaDto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    // Aplicar redondeo al monto si se está actualizando
    if (updateEntradaDto.monto !== undefined) {
      updateEntradaDto.monto = MoneyUtil.round(updateEntradaDto.monto);
    }

    Object.assign(entrada, updateEntradaDto);
    return await this.entradaRepository.save(entrada);
  }

  /**
   * Eliminar una entrada
   * @param id ID de la entrada
   * @returns Resultado de la eliminación
   */
  async remove(id: number): Promise<{ message: string }> {
    const entrada = await this.findOne(id);
    await this.entradaRepository.remove(entrada);
    
    return { 
      message: `Entrada "${entrada.descripcion}" eliminada correctamente` 
    };
  }

  /**
   * Obtener estadísticas de entradas
   * @param fechaInicio Fecha de inicio (opcional)
   * @param fechaFin Fecha de fin (opcional)
   * @returns Estadísticas
   */
  async obtenerEstadisticas(fechaInicio?: Date, fechaFin?: Date) {
    let query = this.entradaRepository.createQueryBuilder('entrada');

    if (fechaInicio && fechaFin) {
      query = query.where('entrada.fecha BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio,
        fechaFin,
      });
    }

    const [entradas, total] = await query.getManyAndCount();
    
    const totalMonto = entradas.reduce((sum, entrada) => sum + entrada.monto, 0);
    const promedioMonto = total > 0 ? totalMonto / total : 0;

    // Agrupar por categoría
    const porCategoria = entradas.reduce((acc, entrada) => {
      const categoria = entrada.categoria || 'SIN_CATEGORIA';
      if (!acc[categoria]) {
        acc[categoria] = { cantidad: 0, monto: 0 };
      }
      acc[categoria].cantidad++;
      acc[categoria].monto += entrada.monto;
      return acc;
    }, {} as Record<string, { cantidad: number; monto: number }>);

    // Agrupar por mes
    const porMes = entradas.reduce((acc, entrada) => {
      const mes = entrada.fecha.toISOString().substring(0, 7); // YYYY-MM
      if (!acc[mes]) {
        acc[mes] = { cantidad: 0, monto: 0 };
      }
      acc[mes].cantidad++;
      acc[mes].monto += entrada.monto;
      return acc;
    }, {} as Record<string, { cantidad: number; monto: number }>);

    return {
      resumen: {
        totalEntradas: total,
        totalMonto: MoneyUtil.round(totalMonto),
        promedioMonto: MoneyUtil.round(promedioMonto),
      },
      porCategoria,
      porMes,
      periodo: fechaInicio && fechaFin ? {
        inicio: fechaInicio.toISOString().split('T')[0],
        fin: fechaFin.toISOString().split('T')[0],
      } : null,
    };
  }
}

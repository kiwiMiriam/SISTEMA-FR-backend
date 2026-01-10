import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Producto } from '../../entities/producto.entity';
import { MovimientoInventario } from '../../entities/movimiento-inventario.entity';
import { TipoMovimiento } from '../../common/enums';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { ActualizarStockDto } from './dto/actualizar-stock.dto';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private productoRepository: Repository<Producto>,
    @InjectRepository(MovimientoInventario)
    private movimientoRepository: Repository<MovimientoInventario>,
  ) {}

  async create(createProductoDto: CreateProductoDto, cajero: string): Promise<Producto> {
    // Verificar que el código de barras no exista
    const existingProduct = await this.productoRepository.findOne({
      where: { codigoBarra: createProductoDto.codigoBarra },
    });

    if (existingProduct) {
      throw new ConflictException('El código de barras ya existe');
    }

    try {
      const producto = this.productoRepository.create(createProductoDto);
      const savedProduct = await this.productoRepository.save(producto);

      // Registrar movimiento inicial de inventario si tiene stock
      if (savedProduct.cantidadActual > 0) {
        await this.registrarMovimiento({
          codigoBarra: savedProduct.codigoBarra,
          descripcion: savedProduct.productoDescripcion,
          costo: savedProduct.costo,
          precioVenta: savedProduct.precio,
          existenciaAnterior: 0,
          existenciaNueva: savedProduct.cantidadActual,
          existencia: savedProduct.cantidadActual, // Campo requerido
          invMinimo: savedProduct.cantidadMinima,
          tipo: TipoMovimiento.ENTRADA,
          cantidad: savedProduct.cantidadActual,
          cajero,
          observaciones: 'Stock inicial del producto',
        });
      }

      return savedProduct;
    } catch (error) {
      // Manejar errores de secuencia duplicada
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        throw new BadRequestException(
          'Error al generar ID del producto. Por favor ejecute la sincronización de secuencias (POST /admin/sync-sequences) y reintente.'
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<Producto[]> {
    return this.productoRepository.find({
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findById(id: number): Promise<Producto> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    return producto;
  }

  async findByIds(ids: number[]): Promise<Producto[]> {
    return await this.productoRepository.findByIds(ids);
  }

  async findByCodigoBarra(codigoBarra: string): Promise<Producto> {
    const producto = await this.productoRepository.findOne({ where: { codigoBarra } });
    if (!producto) {
      throw new NotFoundException('Producto no encontrado');
    }
    return producto;
  }

  async search(query: string, paginationDto: PaginationDto): Promise<PaginatedResult<Producto>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.productoRepository.findAndCount({
      where: [
        { productoDescripcion: Like(`%${query}%`) },
        { codigoBarra: Like(`%${query}%`) },
        { categoria: Like(`%${query}%`) },
        { proveedor: Like(`%${query}%`) },
      ],
      skip,
      take: limit,
      order: { fechaCreacion: 'DESC' },
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

  async findByCategoria(categoria: string, paginationDto: PaginationDto): Promise<PaginatedResult<Producto>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.productoRepository.findAndCount({
      where: { categoria },
      skip,
      take: limit,
      order: { productoDescripcion: 'ASC' },
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

  async findByProveedor(proveedor: string, paginationDto: PaginationDto): Promise<PaginatedResult<Producto>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.productoRepository.findAndCount({
      where: { proveedor },
      skip,
      take: limit,
      order: { productoDescripcion: 'ASC' },
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

  async findStockBajo(): Promise<Producto[]> {
    return this.productoRepository
      .createQueryBuilder('producto')
      .where('producto.cantidadActual <= producto.cantidadMinima')
      .andWhere('producto.usaInventario = true')
      .andWhere('producto.mostrar = true')
      .orderBy('producto.cantidadActual', 'ASC')
      .getMany();
  }

  async getCategorias(): Promise<string[]> {
    const result = await this.productoRepository
      .createQueryBuilder('producto')
      .select('DISTINCT producto.categoria', 'categoria')
      .where('producto.categoria IS NOT NULL')
      .andWhere('producto.categoria != \'\'')
      .getRawMany();

    return result.map(r => r.categoria);
  }

  async update(id: number, updateProductoDto: UpdateProductoDto): Promise<Producto> {
    const producto = await this.findById(id);

    if (updateProductoDto.codigoBarra && updateProductoDto.codigoBarra !== producto.codigoBarra) {
      const existingProduct = await this.productoRepository.findOne({
        where: { codigoBarra: updateProductoDto.codigoBarra },
      });
      if (existingProduct) {
        throw new ConflictException('El código de barras ya existe');
      }
    }

    await this.productoRepository.update(id, updateProductoDto);
    return this.findById(id);
  }

  async actualizarStock(id: number, actualizarStockDto: ActualizarStockDto, cajero: string): Promise<Producto> {
    const producto = await this.findById(id);
    const { cantidad, tipo, observaciones, proveedor, numeroFactura } = actualizarStockDto;

    const existenciaAnterior = producto.cantidadActual;
    let existenciaNueva: number;

    switch (tipo) {
      case TipoMovimiento.ENTRADA:
        existenciaNueva = existenciaAnterior + cantidad;
        break;
      case TipoMovimiento.SALIDA:
        existenciaNueva = Math.max(0, existenciaAnterior - cantidad);
        break;
      case TipoMovimiento.AJUSTE:
        existenciaNueva = cantidad; // Cantidad es el nuevo stock total
        break;
      default:
        throw new Error('Tipo de movimiento no válido');
    }

    // Actualizar stock del producto
    await this.productoRepository.update(id, { cantidadActual: existenciaNueva });

    // Registrar movimiento
    await this.registrarMovimiento({
      codigoBarra: producto.codigoBarra,
      descripcion: producto.productoDescripcion,
      costo: producto.costo,
      precioVenta: producto.precio,
      existenciaAnterior,
      existenciaNueva,
      existencia: existenciaNueva, // Campo requerido
      invMinimo: producto.cantidadMinima,
      tipo,
      cantidad: tipo === TipoMovimiento.AJUSTE ? existenciaNueva - existenciaAnterior : cantidad,
      cajero,
      proveedor,
      numeroFactura,
      observaciones,
    });

    return this.findById(id);
  }

  async descontarStock(codigoBarra: string, cantidad: number, cajero: string, ventaId?: number): Promise<void> {
    const producto = await this.findByCodigoBarra(codigoBarra);

    if (!producto.usaInventario) {
      return; // No descontar stock si el producto no usa inventario
    }

    const existenciaAnterior = producto.cantidadActual;
    const existenciaNueva = Math.max(0, existenciaAnterior - cantidad);

    await this.productoRepository.update(producto.id, { cantidadActual: existenciaNueva });

    await this.registrarMovimiento({
      codigoBarra: producto.codigoBarra,
      descripcion: producto.productoDescripcion,
      costo: producto.costo,
      precioVenta: producto.precio,
      existenciaAnterior,
      existenciaNueva,
      existencia: existenciaNueva, // Campo requerido
      invMinimo: producto.cantidadMinima,
      tipo: TipoMovimiento.VENTA,
      cantidad,
      cajero,
      ventaId,
      observaciones: `Venta - Ticket ID: ${ventaId}`,
    });
  }

  async devolverStock(codigoBarra: string, cantidad: number, cajero: string, ventaId?: number): Promise<void> {
    const producto = await this.findByCodigoBarra(codigoBarra);

    if (!producto.usaInventario) {
      return;
    }

    const existenciaAnterior = producto.cantidadActual;
    const existenciaNueva = existenciaAnterior + cantidad;

    await this.productoRepository.update(producto.id, { cantidadActual: existenciaNueva });

    await this.registrarMovimiento({
      codigoBarra: producto.codigoBarra,
      descripcion: producto.productoDescripcion,
      costo: producto.costo,
      precioVenta: producto.precio,
      existenciaAnterior,
      existenciaNueva,
      existencia: existenciaNueva, // Campo requerido
      invMinimo: producto.cantidadMinima,
      tipo: TipoMovimiento.DEVOLUCION,
      cantidad,
      cajero,
      ventaId,
      observaciones: `Devolución - Ticket ID: ${ventaId}`,
    });
  }

  async remove(id: number): Promise<void> {
    const producto = await this.findById(id);
    await this.productoRepository.update(id, { mostrar: false });
  }

  async activate(id: number): Promise<Producto> {
    await this.productoRepository.update(id, { mostrar: true });
    return this.findById(id);
  }

  private async registrarMovimiento(movimientoData: Partial<MovimientoInventario>): Promise<MovimientoInventario> {
    const movimiento = this.movimientoRepository.create(movimientoData);
    return this.movimientoRepository.save(movimiento);
  }

  async getMovimientosInventario(paginationDto: PaginationDto): Promise<PaginatedResult<MovimientoInventario>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.movimientoRepository.findAndCount({
      skip,
      take: limit,
      order: { hora: 'DESC' },
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

  async getMovimientosByProducto(codigoBarra: string, paginationDto: PaginationDto): Promise<PaginatedResult<MovimientoInventario>> {
    const { page, limit, skip } = paginationDto;

    const [data, total] = await this.movimientoRepository.findAndCount({
      where: { codigoBarra },
      skip,
      take: limit,
      order: { hora: 'DESC' },
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
}

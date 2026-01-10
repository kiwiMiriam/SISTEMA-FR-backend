import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  Index
} from 'typeorm';
import { decimalTransformer } from '../common/transformers/decimal.transformer';

/**
 * Entidad para registrar ingresos no relacionados con ventas
 * Ejemplos: donaciones, ingresos por servicios, reembolsos, etc.
 */
@Entity('entradas')
@Index(['fecha'])
@Index(['registradoPor'])
export class Entrada {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { 
    precision: 10, 
    scale: 2, 
    transformer: decimalTransformer,
    comment: 'Monto del ingreso'
  })
  monto: number;

  @Column({ 
    length: 500,
    comment: 'Descripción detallada del ingreso'
  })
  descripcion: string;

  @Column({ 
    length: 100,
    nullable: true,
    comment: 'Categoría del ingreso (ej: DONACION, SERVICIO, REEMBOLSO)'
  })
  categoria: string;

  @Column({ 
    length: 100,
    comment: 'Usuario que registró el ingreso'
  })
  registradoPor: string;

  @Column({ 
    type: 'date',
    comment: 'Fecha del ingreso'
  })
  fecha: Date;

  @Column({ 
    length: 1000,
    nullable: true,
    comment: 'Observaciones adicionales'
  })
  observaciones: string;

  @CreateDateColumn()
  fechaCreacion: Date;

  @UpdateDateColumn()
  fechaActualizacion: Date;

  // Computed properties
  get montoFormateado(): string {
    return `S/ ${this.monto.toFixed(2)}`;
  }

  get fechaFormateada(): string {
    return this.fecha.toLocaleDateString('es-PE');
  }
}


import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { Venta } from './venta.entity';
import { decimalTransformer } from '../common/transformers/decimal.transformer';

export enum TipoMovimientoPuntos {
  ACUMULACION = 'ACUMULACION',
  CANJE = 'CANJE',
  REVERSO = 'REVERSO',
  AJUSTE = 'AJUSTE'
}

/**
 * Entidad para registrar todos los movimientos de puntos de clientes
 * Separación clara entre ANULACIÓN (REVERSO) y CANJE
 */
@Entity('cliente_puntos_movimientos')
@Index(['clienteId', 'fechaMovimiento'])
@Index(['tipo', 'fechaMovimiento'])
export class ClientePuntosMovimiento {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clienteId: number;

  @Column({
    type: 'enum',
    enum: TipoMovimientoPuntos,
    comment: 'ACUMULACION: ganó puntos, CANJE: usó puntos, REVERSO: anulación, AJUSTE: corrección manual'
  })
  tipo: TipoMovimientoPuntos;

  @Column('int', {
    comment: 'Cantidad de puntos (positivo para ACUMULACION, negativo para CANJE/REVERSO)'
  })
  puntos: number;

  @Column('decimal', { 
    precision: 10, 
    scale: 2, 
    transformer: decimalTransformer,
    comment: 'Valor monetario equivalente del movimiento'
  })
  valorMonetario: number;

  @Column({ 
    length: 500,
    comment: 'Descripción del motivo del movimiento'
  })
  motivo: string;

  @Column({ 
    nullable: true,
    comment: 'ID de la venta relacionada (si aplica)'
  })
  ventaId: number;

  @Column({ 
    length: 100,
    comment: 'Usuario que registró el movimiento'
  })
  registradoPor: string;

  @Column('int', {
    comment: 'Saldo de puntos después de este movimiento'
  })
  saldoAnterior: number;

  @Column('int', {
    comment: 'Saldo de puntos después de este movimiento'
  })
  saldoPosterior: number;

  @CreateDateColumn()
  fechaMovimiento: Date;

  // Relaciones
  @ManyToOne(() => Cliente, { eager: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @ManyToOne(() => Venta, { eager: false, nullable: true })
  @JoinColumn({ name: 'ventaId' })
  venta: Venta;

  // Computed properties
  get esPositivo(): boolean {
    return this.puntos > 0;
  }

  get esNegativo(): boolean {
    return this.puntos < 0;
  }
}


import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Entidad de base de datos para almacenar scores financieros calculados
 * Almacena los resultados de Piotroski F-Score, Altman Z-Score y Beneish M-Score
 */
@Entity('financial_scores')
@Index(['ticker', 'calculatedAt'])
@Index(['overallRating'])
@Index(['riskLevel'])
export class FinancialScoresEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, nullable: false })
  ticker: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  companyName: string;

  // Piotroski F-Score
  @Column({ type: 'int', nullable: false })
  piotroskiTotalScore: number;

  @Column({ type: 'text', nullable: false })
  piotroskiData: string; // JSON serializado con todos los componentes

  // Altman Z-Score
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: false })
  altmanTotalScore: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  altmanInterpretation: string; // 'SAFE', 'GREY_ZONE', 'DISTRESS'

  @Column({ type: 'text', nullable: false })
  altmanData: string; // JSON serializado con todos los componentes

  // Beneish M-Score
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: false })
  beneishTotalScore: number;

  @Column({ type: 'varchar', length: 20, nullable: false })
  beneishInterpretation: string; // 'LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK'

  @Column({ type: 'text', nullable: false })
  beneishData: string; // JSON serializado con todos los componentes

  // Evaluación consolidada
  @Column({ type: 'varchar', length: 20, nullable: false })
  overallRating: string; // 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'

  @Column({ type: 'varchar', length: 20, nullable: false })
  riskLevel: string; // 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'

  @Column({ type: 'varchar', length: 20, nullable: false })
  dataSource: string; // 'API', 'MANUAL_UPLOAD'

  @Column({ type: 'timestamp', nullable: false })
  calculatedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

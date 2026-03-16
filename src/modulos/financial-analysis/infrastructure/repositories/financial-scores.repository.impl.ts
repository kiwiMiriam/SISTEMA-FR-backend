import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IFinancialScoresRepository } from '../../domain/repositories/financial-data.repository';
import { ConsolidatedScores, HistoricalScores } from '../../domain/entities/financial-scores.entity';
import { CacheService } from '../services/cache.service';
import { FinancialScoresEntity } from '../../../entities/financial-scores.entity';

/**
 * Implementación del repositorio de scores financieros
 * Combina persistencia en base de datos con sistema de caché
 */
@Injectable()
export class FinancialScoresRepositoryImpl implements IFinancialScoresRepository {
  private readonly logger = new Logger(FinancialScoresRepositoryImpl.name);

  constructor(
    @InjectRepository(FinancialScoresEntity)
    private readonly scoresRepository: Repository<FinancialScoresEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async saveScores(scores: ConsolidatedScores): Promise<void> {
    try {
      // Convertir entidad de dominio a entidad de base de datos
      const scoresEntity = this.toEntity(scores);
      
      // Verificar si ya existe un registro para este ticker y fecha
      const existingScore = await this.scoresRepository.findOne({
        where: {
          ticker: scores.ticker,
          calculatedAt: scores.calculatedAt,
        },
      });

      if (existingScore) {
        // Actualizar registro existente
        await this.scoresRepository.update(existingScore.id, scoresEntity);
        this.logger.debug(`Updated existing scores for ${scores.ticker}`);
      } else {
        // Crear nuevo registro
        await this.scoresRepository.save(scoresEntity);
        this.logger.debug(`Saved new scores for ${scores.ticker}`);
      }

      // Invalidar caché para forzar actualización
      await this.cacheService.invalidateCache(scores.ticker);

    } catch (error) {
      this.logger.error(`Error saving scores for ${scores.ticker}: ${error.message}`);
      throw error;
    }
  }

  async getScores(ticker: string): Promise<ConsolidatedScores | null> {
    try {
      // 1. Intentar obtener desde caché primero
      const cachedScores = await this.getCachedScores(ticker);
      if (cachedScores) {
        this.logger.debug(`Returning cached scores for ${ticker}`);
        return cachedScores;
      }

      // 2. Obtener desde base de datos
      const scoresEntity = await this.scoresRepository.findOne({
        where: { ticker: ticker.toUpperCase() },
        order: { calculatedAt: 'DESC' }, // Obtener el más reciente
      });

      if (!scoresEntity) {
        this.logger.debug(`No scores found for ticker: ${ticker}`);
        return null;
      }

      // 3. Convertir a entidad de dominio
      const scores = this.toDomain(scoresEntity);

      // 4. Cachear para futuras consultas
      await this.cacheScores(ticker, scores);

      return scores;

    } catch (error) {
      this.logger.error(`Error getting scores for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async getHistoricalScores(ticker: string, periods: number): Promise<HistoricalScores | null> {
    try {
      // Obtener scores históricos desde base de datos
      const historicalEntities = await this.scoresRepository.find({
        where: { ticker: ticker.toUpperCase() },
        order: { calculatedAt: 'DESC' },
        take: periods,
      });

      if (!historicalEntities || historicalEntities.length === 0) {
        this.logger.debug(`No historical scores found for ticker: ${ticker}`);
        return null;
      }

      // Convertir entidades a dominio
      const scores = historicalEntities.map(entity => this.toDomain(entity));

      const historicalScores: HistoricalScores = {
        ticker: ticker.toUpperCase(),
        scores,
        trend: {
          piotroskiTrend: 'STABLE',
          altmanTrend: 'STABLE',
          beneishTrend: 'STABLE',
        },
        lastUpdated: new Date(),
      };

      return historicalScores;

    } catch (error) {
      this.logger.error(`Error getting historical scores for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async cacheScores(ticker: string, scores: ConsolidatedScores, ttl: number = 86400): Promise<void> {
    try {
      await this.cacheService.cacheScores(ticker, scores, ttl);
      this.logger.debug(`Scores cached for ${ticker} with TTL ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error caching scores for ${ticker}: ${error.message}`);
    }
  }

  async getCachedScores(ticker: string): Promise<ConsolidatedScores | null> {
    try {
      return await this.cacheService.getCachedScores(ticker);
    } catch (error) {
      this.logger.error(`Error getting cached scores for ${ticker}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene estadísticas de scores por sector
   */
  async getScoresBySector(sector: string, limit: number = 50): Promise<ConsolidatedScores[]> {
    try {
      const entities = await this.scoresRepository
        .createQueryBuilder('scores')
        .where('scores.sector = :sector', { sector })
        .orderBy('scores.calculatedAt', 'DESC')
        .limit(limit)
        .getMany();

      return entities.map(entity => this.toDomain(entity));

    } catch (error) {
      this.logger.error(`Error getting scores by sector ${sector}: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtiene top performers basado en rating general
   */
  async getTopPerformers(limit: number = 20): Promise<ConsolidatedScores[]> {
    try {
      const entities = await this.scoresRepository
        .createQueryBuilder('scores')
        .where('scores.overallRating IN (:...ratings)', { ratings: ['EXCELLENT', 'GOOD'] })
        .orderBy('scores.calculatedAt', 'DESC')
        .limit(limit)
        .getMany();

      return entities.map(entity => this.toDomain(entity));

    } catch (error) {
      this.logger.error(`Error getting top performers: ${error.message}`);
      return [];
    }
  }

  /**
   * Limpia scores antiguos (más de 2 años)
   */
  async cleanupOldScores(): Promise<void> {
    try {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const result = await this.scoresRepository
        .createQueryBuilder()
        .delete()
        .where('calculatedAt < :date', { date: twoYearsAgo })
        .execute();

      this.logger.debug(`Cleaned up ${result.affected} old score records`);

    } catch (error) {
      this.logger.error(`Error cleaning up old scores: ${error.message}`);
    }
  }

  /**
   * Convierte entidad de dominio a entidad de base de datos
   */
  private toEntity(scores: ConsolidatedScores): Partial<FinancialScoresEntity> {
    return {
      ticker: scores.ticker,
      companyName: scores.companyName,
      
      // Piotroski Score
      piotroskiTotalScore: scores.piotroskiScore.totalScore,
      piotroskiData: JSON.stringify(scores.piotroskiScore),
      
      // Altman Z-Score
      altmanTotalScore: scores.altmanZScore.totalScore,
      altmanInterpretation: scores.altmanZScore.interpretation,
      altmanData: JSON.stringify(scores.altmanZScore),
      
      // Beneish M-Score
      beneishTotalScore: scores.beneishMScore.totalScore,
      beneishInterpretation: scores.beneishMScore.interpretation,
      beneishData: JSON.stringify(scores.beneishMScore),
      
      // Evaluación general
      overallRating: scores.overallRating,
      riskLevel: scores.riskLevel,
      dataSource: scores.dataSource,
      calculatedAt: scores.calculatedAt,
    };
  }

  /**
   * Convierte entidad de base de datos a entidad de dominio
   */
  private toDomain(entity: FinancialScoresEntity): ConsolidatedScores {
    return {
      ticker: entity.ticker,
      companyName: entity.companyName,
      piotroskiScore: JSON.parse(entity.piotroskiData),
      altmanZScore: JSON.parse(entity.altmanData),
      beneishMScore: JSON.parse(entity.beneishData),
      overallRating: entity.overallRating as any,
      riskLevel: entity.riskLevel as any,
      dataSource: entity.dataSource as any,
      calculatedAt: entity.calculatedAt,
    };
  }
}

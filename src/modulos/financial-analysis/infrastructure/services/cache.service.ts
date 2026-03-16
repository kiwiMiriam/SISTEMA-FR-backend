import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FinancialData } from '../../domain/entities/financial-data.entity';
import { ConsolidatedScores } from '../../domain/entities/financial-scores.entity';

/**
 * Servicio de caché para datos financieros
 * Implementa caché Redis con TTL configurable
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL = 86400; // 24 horas en segundos

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Cachea datos financieros
   */
  async cacheFinancialData(ticker: string, data: FinancialData, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const key = this.getFinancialDataKey(ticker);
      await this.cacheManager.set(key, data, ttl * 1000); // Cache manager usa milisegundos
      this.logger.debug(`Cached financial data for ${ticker} with TTL ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error caching financial data for ${ticker}: ${error.message}`);
    }
  }

  /**
   * Obtiene datos financieros desde caché
   */
  async getCachedFinancialData(ticker: string): Promise<FinancialData | null> {
    try {
      const key = this.getFinancialDataKey(ticker);
      const cachedData = await this.cacheManager.get<FinancialData>(key);
      
      if (cachedData) {
        this.logger.debug(`Cache hit for financial data: ${ticker}`);
        return cachedData;
      }
      
      this.logger.debug(`Cache miss for financial data: ${ticker}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cached financial data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  /**
   * Cachea scores financieros
   */
  async cacheScores(ticker: string, scores: ConsolidatedScores, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const key = this.getScoresKey(ticker);
      await this.cacheManager.set(key, scores, ttl * 1000);
      this.logger.debug(`Cached scores for ${ticker} with TTL ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error caching scores for ${ticker}: ${error.message}`);
    }
  }

  /**
   * Obtiene scores desde caché
   */
  async getCachedScores(ticker: string): Promise<ConsolidatedScores | null> {
    try {
      const key = this.getScoresKey(ticker);
      const cachedScores = await this.cacheManager.get<ConsolidatedScores>(key);
      
      if (cachedScores) {
        this.logger.debug(`Cache hit for scores: ${ticker}`);
        return cachedScores;
      }
      
      this.logger.debug(`Cache miss for scores: ${ticker}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cached scores for ${ticker}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica si los datos están en caché y son válidos
   */
  async isCacheValid(ticker: string): Promise<boolean> {
    try {
      const financialDataKey = this.getFinancialDataKey(ticker);
      const scoresKey = this.getScoresKey(ticker);
      
      const [financialData, scores] = await Promise.all([
        this.cacheManager.get(financialDataKey),
        this.cacheManager.get(scoresKey)
      ]);

      return !!(financialData && scores);
    } catch (error) {
      this.logger.error(`Error checking cache validity for ${ticker}: ${error.message}`);
      return false;
    }
  }

  /**
   * Invalida caché para un ticker específico
   */
  async invalidateCache(ticker: string): Promise<void> {
    try {
      const financialDataKey = this.getFinancialDataKey(ticker);
      const scoresKey = this.getScoresKey(ticker);
      
      await Promise.all([
        this.cacheManager.del(financialDataKey),
        this.cacheManager.del(scoresKey)
      ]);
      
      this.logger.debug(`Cache invalidated for ${ticker}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for ${ticker}: ${error.message}`);
    }
  }

  /**
   * Cachea datos genéricos con clave personalizada
   */
  async cacheData<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.cacheManager.set(key, data, ttl * 1000);
      this.logger.debug(`Cached data with key: ${key}`);
    } catch (error) {
      this.logger.error(`Error caching data with key ${key}: ${error.message}`);
    }
  }

  /**
   * Obtiene datos genéricos desde caché
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.cacheManager.get<T>(key);
      
      if (cachedData) {
        this.logger.debug(`Cache hit for key: ${key}`);
        return cachedData;
      }
      
      this.logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting cached data for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getCacheStats(): Promise<any> {
    try {
      // Implementación específica dependiendo del store de caché usado
      return {
        status: 'active',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting cache stats: ${error.message}`);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Limpia todo el caché
   */
  async clearCache(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.warn('Cache cleared completely');
    } catch (error) {
      this.logger.error(`Error clearing cache: ${error.message}`);
    }
  }

  /**
   * Genera clave para datos financieros
   */
  private getFinancialDataKey(ticker: string): string {
    return `financial_data:${ticker.toUpperCase()}`;
  }

  /**
   * Genera clave para scores
   */
  private getScoresKey(ticker: string): string {
    return `scores:${ticker.toUpperCase()}`;
  }

  /**
   * Genera clave para watchlist de usuario
   */
  getUserWatchlistKey(userId: string): string {
    return `watchlist:${userId}`;
  }

  /**
   * Genera clave para datos históricos
   */
  getHistoricalDataKey(ticker: string, periods: number): string {
    return `historical:${ticker.toUpperCase()}:${periods}`;
  }
}

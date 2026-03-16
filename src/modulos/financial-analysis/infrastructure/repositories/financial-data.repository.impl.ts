import { Injectable, Inject, Logger } from '@nestjs/common';
import { IFinancialDataRepository } from '../../domain/repositories/financial-data.repository';
import { FinancialData, HistoricalFinancialData } from '../../domain/entities/financial-data.entity';
import { CacheService } from '../services/cache.service';
import { FinancialModelingPrepAdapter } from '../adapters/financial-modeling-prep.adapter';

/**
 * Implementación del repositorio de datos financieros
 * Combina datos de APIs externas con sistema de caché
 */
@Injectable()
export class FinancialDataRepositoryImpl implements IFinancialDataRepository {
  private readonly logger = new Logger(FinancialDataRepositoryImpl.name);

  constructor(
    private readonly cacheService: CacheService,
    @Inject('ExternalFinancialDataProvider')
    private readonly externalProvider: FinancialModelingPrepAdapter,
  ) {}

  async getFinancialData(ticker: string): Promise<FinancialData | null> {
    try {
      // 1. Intentar obtener desde caché primero
      const cachedData = await this.getCachedFinancialData(ticker);
      if (cachedData) {
        this.logger.debug(`Returning cached financial data for ${ticker}`);
        return cachedData;
      }

      // 2. Si no está en caché, obtener desde API externa
      this.logger.debug(`Fetching financial data from external API for ${ticker}`);
      const externalData = await this.externalProvider.getFinancialData(ticker);
      
      if (!externalData) {
        this.logger.warn(`No financial data found for ticker: ${ticker}`);
        return null;
      }

      // 3. Cachear los datos obtenidos
      await this.cacheFinancialData(ticker, externalData);
      
      return externalData;

    } catch (error) {
      this.logger.error(`Error getting financial data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async getHistoricalFinancialData(ticker: string, periods: number): Promise<HistoricalFinancialData | null> {
    try {
      // 1. Verificar caché para datos históricos
      const cacheKey = this.cacheService.getHistoricalDataKey(ticker, periods);
      const cachedHistorical = await this.cacheService.getCachedData<HistoricalFinancialData>(cacheKey);
      
      if (cachedHistorical) {
        this.logger.debug(`Returning cached historical data for ${ticker}`);
        return cachedHistorical;
      }

      // 2. Obtener desde API externa
      this.logger.debug(`Fetching historical data from external API for ${ticker}`);
      const historicalData = await this.externalProvider.getHistoricalFinancialData(ticker, periods);
      
      if (!historicalData) {
        this.logger.warn(`No historical data found for ticker: ${ticker}`);
        return null;
      }

      // 3. Cachear datos históricos (TTL más largo para datos históricos)
      await this.cacheService.cacheData(cacheKey, historicalData, 172800); // 48 horas
      
      return historicalData;

    } catch (error) {
      this.logger.error(`Error getting historical data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async cacheFinancialData(ticker: string, data: FinancialData, ttl: number = 86400): Promise<void> {
    try {
      await this.cacheService.cacheFinancialData(ticker, data, ttl);
      this.logger.debug(`Financial data cached for ${ticker} with TTL ${ttl}s`);
    } catch (error) {
      this.logger.error(`Error caching financial data for ${ticker}: ${error.message}`);
    }
  }

  async getCachedFinancialData(ticker: string): Promise<FinancialData | null> {
    try {
      return await this.cacheService.getCachedFinancialData(ticker);
    } catch (error) {
      this.logger.error(`Error getting cached financial data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async isCacheValid(ticker: string): Promise<boolean> {
    try {
      return await this.cacheService.isCacheValid(ticker);
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
      await this.cacheService.invalidateCache(ticker);
      this.logger.debug(`Cache invalidated for ${ticker}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for ${ticker}: ${error.message}`);
    }
  }

  /**
   * Obtiene múltiples tickers en paralelo (optimización)
   */
  async getMultipleFinancialData(tickers: string[]): Promise<Map<string, FinancialData | null>> {
    const results = new Map<string, FinancialData | null>();
    
    try {
      // Procesar en paralelo con límite de concurrencia
      const batchSize = 5; // Procesar de 5 en 5 para no sobrecargar la API
      
      for (let i = 0; i < tickers.length; i += batchSize) {
        const batch = tickers.slice(i, i + batchSize);
        const batchPromises = batch.map(async (ticker) => {
          const data = await this.getFinancialData(ticker);
          return { ticker, data };
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(({ ticker, data }) => {
          results.set(ticker, data);
        });

        // Pequeña pausa entre batches para respetar rate limits
        if (i + batchSize < tickers.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return results;

    } catch (error) {
      this.logger.error(`Error getting multiple financial data: ${error.message}`);
      return results;
    }
  }

  /**
   * Precarga datos para una lista de tickers populares
   */
  async preloadPopularTickers(tickers: string[]): Promise<void> {
    try {
      this.logger.debug(`Preloading data for ${tickers.length} popular tickers`);
      
      const results = await this.getMultipleFinancialData(tickers);
      let successCount = 0;
      
      results.forEach((data, ticker) => {
        if (data) {
          successCount++;
        }
      });

      this.logger.debug(`Preloaded ${successCount}/${tickers.length} tickers successfully`);

    } catch (error) {
      this.logger.error(`Error preloading popular tickers: ${error.message}`);
    }
  }
}

import { FinancialData, HistoricalFinancialData } from '../entities/financial-data.entity';
import { ConsolidatedScores, HistoricalScores } from '../entities/financial-scores.entity';

/**
 * Interfaz del repositorio para datos financieros
 * Define los contratos para acceso a datos (Arquitectura Hexagonal - Puerto)
 */
export interface IFinancialDataRepository {
  /**
   * Obtiene datos financieros de una empresa por ticker
   */
  getFinancialData(ticker: string): Promise<FinancialData | null>;

  /**
   * Obtiene datos financieros históricos de una empresa
   */
  getHistoricalFinancialData(ticker: string, periods: number): Promise<HistoricalFinancialData | null>;

  /**
   * Guarda datos financieros en caché
   */
  cacheFinancialData(ticker: string, data: FinancialData, ttl?: number): Promise<void>;

  /**
   * Obtiene datos financieros desde caché
   */
  getCachedFinancialData(ticker: string): Promise<FinancialData | null>;

  /**
   * Verifica si los datos están en caché y son válidos
   */
  isCacheValid(ticker: string): Promise<boolean>;
}

/**
 * Interfaz del repositorio para scores financieros
 */
export interface IFinancialScoresRepository {
  /**
   * Guarda scores calculados
   */
  saveScores(scores: ConsolidatedScores): Promise<void>;

  /**
   * Obtiene scores por ticker
   */
  getScores(ticker: string): Promise<ConsolidatedScores | null>;

  /**
   * Obtiene histórico de scores
   */
  getHistoricalScores(ticker: string, periods: number): Promise<HistoricalScores | null>;

  /**
   * Guarda scores en caché
   */
  cacheScores(ticker: string, scores: ConsolidatedScores, ttl?: number): Promise<void>;

  /**
   * Obtiene scores desde caché
   */
  getCachedScores(ticker: string): Promise<ConsolidatedScores | null>;
}

/**
 * Interfaz del repositorio para watchlist de usuarios
 */
export interface IWatchlistRepository {
  /**
   * Agrega una empresa a la watchlist del usuario
   */
  addToWatchlist(userId: string, ticker: string): Promise<void>;

  /**
   * Remueve una empresa de la watchlist del usuario
   */
  removeFromWatchlist(userId: string, ticker: string): Promise<void>;

  /**
   * Obtiene la watchlist del usuario
   */
  getUserWatchlist(userId: string): Promise<string[]>;

  /**
   * Obtiene la watchlist con los últimos scores cacheados
   */
  getUserWatchlistWithScores(userId: string): Promise<ConsolidatedScores[]>;
}

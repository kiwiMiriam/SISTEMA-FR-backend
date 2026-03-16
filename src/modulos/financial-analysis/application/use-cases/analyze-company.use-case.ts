import { Injectable } from '@nestjs/common';
import { IFinancialDataRepository, IFinancialScoresRepository } from '../../domain/repositories/financial-data.repository';
import { ValuationEngine } from '../../domain/services/valuation-engine.service';
import { ConsolidatedScores } from '../../domain/entities/financial-scores.entity';
import { FinancialData } from '../../domain/entities/financial-data.entity';

export interface AnalyzeCompanyRequest {
  ticker: string;
  forceRefresh?: boolean;
  isManufacturing?: boolean;
}

export interface AnalyzeCompanyResponse {
  success: boolean;
  data?: ConsolidatedScores;
  error?: string;
  fromCache: boolean;
}

/**
 * Caso de uso principal para analizar una empresa
 * Coordina la obtención de datos y el cálculo de scores
 */
@Injectable()
export class AnalyzeCompanyUseCase {
  constructor(
    private readonly financialDataRepository: IFinancialDataRepository,
    private readonly financialScoresRepository: IFinancialScoresRepository,
  ) {}

  async execute(request: AnalyzeCompanyRequest): Promise<AnalyzeCompanyResponse> {
    try {
      const { ticker, forceRefresh = false, isManufacturing = true } = request;

      // 1. Verificar caché si no se fuerza el refresh
      if (!forceRefresh) {
        const cachedScores = await this.financialScoresRepository.getCachedScores(ticker);
        if (cachedScores) {
          return {
            success: true,
            data: cachedScores,
            fromCache: true,
          };
        }
      }

      // 2. Obtener datos financieros actuales
      const currentData = await this.financialDataRepository.getFinancialData(ticker);
      if (!currentData) {
        return {
          success: false,
          error: `No se encontraron datos financieros para el ticker: ${ticker}`,
          fromCache: false,
        };
      }

      // 3. Obtener datos históricos para comparaciones
      const historicalData = await this.financialDataRepository.getHistoricalFinancialData(ticker, 4);
      const previousData = historicalData?.data?.[1]; // Datos del período anterior

      // 4. Calcular scores usando el motor de valuación
      const consolidatedScores = ValuationEngine.calculateConsolidatedScores(
        currentData,
        previousData,
        isManufacturing,
        'API'
      );

      // 5. Guardar scores en base de datos y caché
      await this.financialScoresRepository.saveScores(consolidatedScores);
      await this.financialScoresRepository.cacheScores(ticker, consolidatedScores, 86400); // 24 horas

      // 6. Cachear también los datos financieros
      await this.financialDataRepository.cacheFinancialData(ticker, currentData, 86400);

      return {
        success: true,
        data: consolidatedScores,
        fromCache: false,
      };

    } catch (error) {
      return {
        success: false,
        error: `Error al analizar la empresa: ${error.message}`,
        fromCache: false,
      };
    }
  }
}

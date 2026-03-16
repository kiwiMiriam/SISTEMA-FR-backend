import { Injectable } from '@nestjs/common';
import { IFinancialScoresRepository } from '../../domain/repositories/financial-data.repository';
import { HistoricalScores } from '../../domain/entities/financial-scores.entity';

export interface GetHistoricalAnalysisRequest {
  ticker: string;
  periods?: number;
}

export interface GetHistoricalAnalysisResponse {
  success: boolean;
  data?: HistoricalScores;
  error?: string;
}

/**
 * Caso de uso para obtener análisis histórico de una empresa
 * Permite comparar la evolución de los scores en los últimos trimestres
 */
@Injectable()
export class GetHistoricalAnalysisUseCase {
  constructor(
    private readonly financialScoresRepository: IFinancialScoresRepository,
  ) {}

  async execute(request: GetHistoricalAnalysisRequest): Promise<GetHistoricalAnalysisResponse> {
    try {
      const { ticker, periods = 4 } = request;

      // Obtener histórico de scores
      const historicalScores = await this.financialScoresRepository.getHistoricalScores(ticker, periods);
      
      if (!historicalScores || historicalScores.scores.length === 0) {
        return {
          success: false,
          error: `No se encontró histórico de análisis para el ticker: ${ticker}`,
        };
      }

      // Calcular tendencias si hay suficientes datos
      if (historicalScores.scores.length >= 2) {
        historicalScores.trend = this.calculateTrends(historicalScores.scores);
      }

      return {
        success: true,
        data: historicalScores,
      };

    } catch (error) {
      return {
        success: false,
        error: `Error al obtener análisis histórico: ${error.message}`,
      };
    }
  }

  /**
   * Calcula las tendencias de los scores basado en los datos históricos
   */
  private calculateTrends(scores: any[]): any {
    // Ordenar por fecha (más reciente primero)
    const sortedScores = scores.sort((a, b) => 
      new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime()
    );

    if (sortedScores.length < 2) {
      return {
        piotroskiTrend: 'STABLE',
        altmanTrend: 'STABLE',
        beneishTrend: 'STABLE',
      };
    }

    const latest = sortedScores[0];
    const previous = sortedScores[1];

    return {
      piotroskiTrend: this.calculateTrend(
        latest.piotroskiScore.totalScore,
        previous.piotroskiScore.totalScore
      ),
      altmanTrend: this.calculateTrend(
        latest.altmanZScore.totalScore,
        previous.altmanZScore.totalScore
      ),
      beneishTrend: this.calculateTrend(
        previous.beneishMScore.totalScore, // Invertido porque menor es mejor
        latest.beneishMScore.totalScore
      ),
    };
  }

  /**
   * Calcula la tendencia entre dos valores
   */
  private calculateTrend(current: number, previous: number): 'IMPROVING' | 'STABLE' | 'DECLINING' {
    const threshold = 0.05; // 5% de cambio para considerar estable
    const percentChange = Math.abs((current - previous) / previous);

    if (percentChange <= threshold) {
      return 'STABLE';
    }

    return current > previous ? 'IMPROVING' : 'DECLINING';
  }
}

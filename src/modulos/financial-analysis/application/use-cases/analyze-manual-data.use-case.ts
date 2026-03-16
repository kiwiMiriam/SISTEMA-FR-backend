import { Injectable } from '@nestjs/common';
import { ValuationEngine } from '../../domain/services/valuation-engine.service';
import { ConsolidatedScores } from '../../domain/entities/financial-scores.entity';
import { ManualFinancialData } from '../../domain/entities/financial-data.entity';

export interface AnalyzeManualDataRequest {
  currentData: ManualFinancialData;
  previousData?: ManualFinancialData;
  isManufacturing?: boolean;
  companyName?: string;
  ticker?: string;
}

export interface AnalyzeManualDataResponse {
  success: boolean;
  data?: ConsolidatedScores;
  error?: string;
}

/**
 * Caso de uso para analizar datos financieros manuales
 * Permite análisis de empresas que no cotizan en bolsa
 */
@Injectable()
export class AnalyzeManualDataUseCase {
  
  async execute(request: AnalyzeManualDataRequest): Promise<AnalyzeManualDataResponse> {
    try {
      const { 
        currentData, 
        previousData, 
        isManufacturing = true,
        companyName = 'Empresa Manual',
        ticker = 'MANUAL'
      } = request;

      // Validar datos mínimos requeridos
      const validationError = this.validateRequiredData(currentData);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      // Convertir datos manuales a formato FinancialData
      const financialData = this.convertToFinancialData(currentData, companyName, ticker);
      const previousFinancialData = previousData 
        ? this.convertToFinancialData(previousData, companyName, ticker)
        : undefined;

      // Calcular scores usando el motor de valuación
      const consolidatedScores = ValuationEngine.calculateConsolidatedScores(
        financialData,
        previousFinancialData,
        isManufacturing,
        'MANUAL_UPLOAD'
      );

      return {
        success: true,
        data: consolidatedScores,
      };

    } catch (error) {
      return {
        success: false,
        error: `Error al analizar datos manuales: ${error.message}`,
      };
    }
  }

  /**
   * Valida que los datos mínimos requeridos estén presentes
   */
  private validateRequiredData(data: ManualFinancialData): string | null {
    const requiredFields = [
      'revenue',
      'netIncome',
      'totalAssets',
      'totalLiabilities',
      'operatingCashFlow',
      'currentAssets',
      'currentLiabilities'
    ];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return `Campo requerido faltante: ${field}`;
      }
    }

    // Validar que los números sean válidos
    const numericFields = [
      'revenue', 'netIncome', 'totalAssets', 'totalLiabilities', 
      'operatingCashFlow', 'currentAssets', 'currentLiabilities'
    ];

    for (const field of numericFields) {
      if (typeof data[field] !== 'number' || isNaN(data[field])) {
        return `El campo ${field} debe ser un número válido`;
      }
    }

    // Validaciones de lógica de negocio
    if (data.totalAssets <= 0) {
      return 'Los activos totales deben ser mayores a cero';
    }

    if (data.revenue <= 0) {
      return 'Los ingresos deben ser mayores a cero';
    }

    return null;
  }

  /**
   * Convierte datos manuales al formato FinancialData completo
   */
  private convertToFinancialData(
    manualData: ManualFinancialData, 
    companyName: string, 
    ticker: string
  ) {
    const currentDate = new Date();
    
    return {
      // Datos básicos
      ticker,
      companyName,
      sector: manualData.sector || 'Unknown',
      industry: manualData.industry || 'Unknown',
      marketCap: manualData.marketCap || 0,

      // Estado de Resultados
      revenue: manualData.revenue,
      netIncome: manualData.netIncome,
      grossProfit: manualData.grossProfit || (manualData.revenue * 0.3), // Estimación si no se proporciona
      operatingIncome: manualData.operatingIncome || (manualData.netIncome * 1.2), // Estimación
      ebitda: manualData.ebitda || (manualData.operatingIncome || manualData.netIncome * 1.3), // Estimación

      // Balance General
      totalAssets: manualData.totalAssets,
      currentAssets: manualData.currentAssets,
      totalLiabilities: manualData.totalLiabilities,
      currentLiabilities: manualData.currentLiabilities,
      longTermDebt: manualData.longTermDebt || 0,
      shareholdersEquity: manualData.shareholdersEquity || (manualData.totalAssets - manualData.totalLiabilities),
      retainedEarnings: manualData.retainedEarnings || (manualData.netIncome * 0.7), // Estimación
      workingCapital: manualData.workingCapital || (manualData.currentAssets - manualData.currentLiabilities),

      // Flujo de Efectivo
      operatingCashFlow: manualData.operatingCashFlow,
      freeCashFlow: manualData.freeCashFlow || (manualData.operatingCashFlow - (manualData.capitalExpenditures || 0)),
      capitalExpenditures: manualData.capitalExpenditures || 0,

      // Datos adicionales
      sharesOutstanding: manualData.sharesOutstanding || 1000000, // Valor por defecto
      bookValue: manualData.bookValue || (manualData.totalAssets - manualData.totalLiabilities),
      tangibleBookValue: manualData.tangibleBookValue || (manualData.totalAssets - manualData.totalLiabilities),

      // Datos históricos (opcionales)
      previousYearRevenue: manualData.previousYearRevenue,
      previousYearNetIncome: manualData.previousYearNetIncome,
      previousYearAssets: manualData.previousYearAssets,
      previousYearEquity: manualData.previousYearEquity,

      // Metadatos
      reportDate: currentDate,
      fiscalYear: currentDate.getFullYear(),
      fiscalQuarter: Math.ceil((currentDate.getMonth() + 1) / 3),
      currency: manualData.currency || 'USD',
    };
  }
}

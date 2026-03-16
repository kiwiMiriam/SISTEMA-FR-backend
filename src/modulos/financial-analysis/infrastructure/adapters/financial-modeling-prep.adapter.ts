import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IFinancialDataRepository } from '../../domain/repositories/financial-data.repository';
import { FinancialData, HistoricalFinancialData } from '../../domain/entities/financial-data.entity';

/**
 * Adaptador para Financial Modeling Prep API
 * Implementa la interfaz IFinancialDataRepository para obtener datos de APIs externas
 */
@Injectable()
export class FinancialModelingPrepAdapter implements IFinancialDataRepository {
  private readonly logger = new Logger(FinancialModelingPrepAdapter.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://financialmodelingprep.com/api/v3';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FMP_API_KEY');
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      params: {
        apikey: this.apiKey,
      },
    });

    // Interceptor para logging y rate limiting
    this.httpClient.interceptors.request.use((config) => {
      this.logger.debug(`Making request to: ${config.url}`);
      return config;
    });

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received from: ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`API Error: ${error.message}`, error.stack);
        return Promise.reject(error);
      }
    );
  }

  async getFinancialData(ticker: string): Promise<FinancialData | null> {
    try {
      // Obtener datos de múltiples endpoints en paralelo
      const [
        incomeStatement,
        balanceSheet,
        cashFlowStatement,
        companyProfile,
        keyMetrics
      ] = await Promise.all([
        this.getIncomeStatement(ticker),
        this.getBalanceSheet(ticker),
        this.getCashFlowStatement(ticker),
        this.getCompanyProfile(ticker),
        this.getKeyMetrics(ticker)
      ]);

      if (!incomeStatement || !balanceSheet || !cashFlowStatement) {
        this.logger.warn(`Incomplete financial data for ticker: ${ticker}`);
        return null;
      }

      // Combinar datos de diferentes fuentes
      const financialData: FinancialData = {
        // Datos básicos
        ticker: ticker.toUpperCase(),
        companyName: companyProfile?.companyName || ticker,
        sector: companyProfile?.sector || 'Unknown',
        industry: companyProfile?.industry || 'Unknown',
        marketCap: companyProfile?.mktCap || 0,

        // Estado de Resultados
        revenue: incomeStatement.revenue || 0,
        netIncome: incomeStatement.netIncome || 0,
        grossProfit: incomeStatement.grossProfit || 0,
        operatingIncome: incomeStatement.operatingIncome || 0,
        ebitda: incomeStatement.ebitda || 0,

        // Balance General
        totalAssets: balanceSheet.totalAssets || 0,
        currentAssets: balanceSheet.totalCurrentAssets || 0,
        totalLiabilities: balanceSheet.totalLiabilities || 0,
        currentLiabilities: balanceSheet.totalCurrentLiabilities || 0,
        longTermDebt: balanceSheet.longTermDebt || 0,
        shareholdersEquity: balanceSheet.totalStockholdersEquity || 0,
        retainedEarnings: balanceSheet.retainedEarnings || 0,
        workingCapital: (balanceSheet.totalCurrentAssets || 0) - (balanceSheet.totalCurrentLiabilities || 0),

        // Flujo de Efectivo
        operatingCashFlow: cashFlowStatement.operatingCashFlow || 0,
        freeCashFlow: cashFlowStatement.freeCashFlow || 0,
        capitalExpenditures: Math.abs(cashFlowStatement.capitalExpenditure || 0),

        // Datos adicionales
        sharesOutstanding: keyMetrics?.sharesOutstanding || companyProfile?.sharesOutstanding || 0,
        bookValue: keyMetrics?.bookValuePerShare || 0,
        tangibleBookValue: keyMetrics?.tangibleBookValuePerShare || 0,

        // Metadatos
        reportDate: new Date(incomeStatement.date || Date.now()),
        fiscalYear: parseInt(incomeStatement.calendarYear) || new Date().getFullYear(),
        fiscalQuarter: this.extractQuarter(incomeStatement.period) || 4,
        currency: 'USD',
      };

      return financialData;

    } catch (error) {
      this.logger.error(`Error fetching financial data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  async getHistoricalFinancialData(ticker: string, periods: number): Promise<HistoricalFinancialData | null> {
    try {
      // Obtener datos históricos (últimos períodos)
      const [
        historicalIncome,
        historicalBalance,
        historicalCashFlow
      ] = await Promise.all([
        this.getHistoricalIncomeStatement(ticker, periods),
        this.getHistoricalBalanceSheet(ticker, periods),
        this.getHistoricalCashFlowStatement(ticker, periods)
      ]);

      if (!historicalIncome?.length || !historicalBalance?.length || !historicalCashFlow?.length) {
        return null;
      }

      const historicalData: FinancialData[] = [];

      // Combinar datos históricos por período
      for (let i = 0; i < Math.min(periods, historicalIncome.length); i++) {
        const income = historicalIncome[i];
        const balance = historicalBalance[i];
        const cashFlow = historicalCashFlow[i];

        if (income && balance && cashFlow) {
          const data: FinancialData = {
            ticker: ticker.toUpperCase(),
            companyName: ticker,
            sector: 'Unknown',
            industry: 'Unknown',
            marketCap: 0,

            // Estado de Resultados
            revenue: income.revenue || 0,
            netIncome: income.netIncome || 0,
            grossProfit: income.grossProfit || 0,
            operatingIncome: income.operatingIncome || 0,
            ebitda: income.ebitda || 0,

            // Balance General
            totalAssets: balance.totalAssets || 0,
            currentAssets: balance.totalCurrentAssets || 0,
            totalLiabilities: balance.totalLiabilities || 0,
            currentLiabilities: balance.totalCurrentLiabilities || 0,
            longTermDebt: balance.longTermDebt || 0,
            shareholdersEquity: balance.totalStockholdersEquity || 0,
            retainedEarnings: balance.retainedEarnings || 0,
            workingCapital: (balance.totalCurrentAssets || 0) - (balance.totalCurrentLiabilities || 0),

            // Flujo de Efectivo
            operatingCashFlow: cashFlow.operatingCashFlow || 0,
            freeCashFlow: cashFlow.freeCashFlow || 0,
            capitalExpenditures: Math.abs(cashFlow.capitalExpenditure || 0),

            // Datos adicionales
            sharesOutstanding: 0,
            bookValue: 0,
            tangibleBookValue: 0,

            // Metadatos
            reportDate: new Date(income.date || Date.now()),
            fiscalYear: parseInt(income.calendarYear) || new Date().getFullYear(),
            fiscalQuarter: this.extractQuarter(income.period) || 4,
            currency: 'USD',
          };

          historicalData.push(data);
        }
      }

      return {
        ticker: ticker.toUpperCase(),
        data: historicalData,
        lastUpdated: new Date(),
      };

    } catch (error) {
      this.logger.error(`Error fetching historical data for ${ticker}: ${error.message}`);
      return null;
    }
  }

  // Métodos de caché (implementados por el CacheService)
  async cacheFinancialData(ticker: string, data: FinancialData, ttl?: number): Promise<void> {
    // Implementado por el CacheService
  }

  async getCachedFinancialData(ticker: string): Promise<FinancialData | null> {
    // Implementado por el CacheService
    return null;
  }

  async isCacheValid(ticker: string): Promise<boolean> {
    // Implementado por el CacheService
    return false;
  }

  // Métodos privados para llamadas específicas a la API
  private async getIncomeStatement(ticker: string) {
    const response = await this.httpClient.get(`/income-statement/${ticker}`, {
      params: { limit: 1 }
    });
    return response.data[0];
  }

  private async getBalanceSheet(ticker: string) {
    const response = await this.httpClient.get(`/balance-sheet-statement/${ticker}`, {
      params: { limit: 1 }
    });
    return response.data[0];
  }

  private async getCashFlowStatement(ticker: string) {
    const response = await this.httpClient.get(`/cash-flow-statement/${ticker}`, {
      params: { limit: 1 }
    });
    return response.data[0];
  }

  private async getCompanyProfile(ticker: string) {
    const response = await this.httpClient.get(`/profile/${ticker}`);
    return response.data[0];
  }

  private async getKeyMetrics(ticker: string) {
    const response = await this.httpClient.get(`/key-metrics/${ticker}`, {
      params: { limit: 1 }
    });
    return response.data[0];
  }

  private async getHistoricalIncomeStatement(ticker: string, periods: number) {
    const response = await this.httpClient.get(`/income-statement/${ticker}`, {
      params: { limit: periods }
    });
    return response.data;
  }

  private async getHistoricalBalanceSheet(ticker: string, periods: number) {
    const response = await this.httpClient.get(`/balance-sheet-statement/${ticker}`, {
      params: { limit: periods }
    });
    return response.data;
  }

  private async getHistoricalCashFlowStatement(ticker: string, periods: number) {
    const response = await this.httpClient.get(`/cash-flow-statement/${ticker}`, {
      params: { limit: periods }
    });
    return response.data;
  }

  private extractQuarter(period: string): number {
    if (!period) return 4;
    if (period.includes('Q1')) return 1;
    if (period.includes('Q2')) return 2;
    if (period.includes('Q3')) return 3;
    if (period.includes('Q4')) return 4;
    return 4; // Default to Q4
  }
}

/**
 * Entidad de dominio para datos financieros
 * Representa los datos financieros fundamentales de una empresa
 */
export interface FinancialData {
  // Datos básicos de la empresa
  ticker: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCap: number;
  
  // Estado de Resultados
  revenue: number;
  netIncome: number;
  grossProfit: number;
  operatingIncome: number;
  ebitda: number;
  
  // Balance General
  totalAssets: number;
  currentAssets: number;
  totalLiabilities: number;
  currentLiabilities: number;
  longTermDebt: number;
  shareholdersEquity: number;
  retainedEarnings: number;
  workingCapital: number;
  
  // Flujo de Efectivo
  operatingCashFlow: number;
  freeCashFlow: number;
  capitalExpenditures: number;
  
  // Datos adicionales para cálculos
  sharesOutstanding: number;
  bookValue: number;
  tangibleBookValue: number;
  
  // Datos históricos para comparaciones
  previousYearRevenue?: number;
  previousYearNetIncome?: number;
  previousYearAssets?: number;
  previousYearEquity?: number;
  
  // Metadatos
  reportDate: Date;
  fiscalYear: number;
  fiscalQuarter: number;
  currency: string;
}

/**
 * Entidad para datos financieros históricos
 */
export interface HistoricalFinancialData {
  ticker: string;
  data: FinancialData[];
  lastUpdated: Date;
}

/**
 * Entidad para datos financieros manuales (upload)
 */
export interface ManualFinancialData extends Omit<FinancialData, 'ticker' | 'companyName'> {
  companyName?: string;
  ticker?: string;
}

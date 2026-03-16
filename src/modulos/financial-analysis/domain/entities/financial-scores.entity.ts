/**
 * Entidad para el Piotroski F-Score
 * Score de 0 a 9 que evalúa la fortaleza financiera
 */
export interface PiotroskiScore {
  totalScore: number; // 0-9
  profitability: {
    positiveNetIncome: number; // 1 si > 0, 0 si <= 0
    positiveOperatingCashFlow: number; // 1 si > 0, 0 si <= 0
    improvingROA: number; // 1 si ROA actual > ROA anterior
    operatingCashFlowVsNetIncome: number; // 1 si OCF > Net Income
  };
  leverage: {
    decreasingLongTermDebt: number; // 1 si deuda actual < deuda anterior
    improvingCurrentRatio: number; // 1 si ratio actual > ratio anterior
    noNewShares: number; // 1 si acciones actuales <= acciones anteriores
  };
  efficiency: {
    improvingGrossMargin: number; // 1 si margen actual > margen anterior
    improvingAssetTurnover: number; // 1 si turnover actual > turnover anterior
  };
  calculatedAt: Date;
}

/**
 * Entidad para el Altman Z-Score
 * Predictor de bancarrota empresarial
 */
export interface AltmanZScore {
  totalScore: number;
  interpretation: 'SAFE' | 'GREY_ZONE' | 'DISTRESS';
  components: {
    workingCapitalToTotalAssets: number; // A = (Current Assets - Current Liabilities) / Total Assets
    retainedEarningsToTotalAssets: number; // B = Retained Earnings / Total Assets
    ebitToTotalAssets: number; // C = EBIT / Total Assets
    marketValueEquityToBookValueDebt: number; // D = Market Value of Equity / Book Value of Total Debt
    salesToTotalAssets: number; // E = Sales / Total Assets
  };
  formula: {
    A: number; // 1.2 * A
    B: number; // 1.4 * B
    C: number; // 3.3 * C
    D: number; // 0.6 * D
    E: number; // 1.0 * E
  };
  isManufacturing: boolean;
  calculatedAt: Date;
}

/**
 * Entidad para el Beneish M-Score
 * Detector de manipulación contable (8 variables)
 */
export interface BeneishMScore {
  totalScore: number;
  interpretation: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK';
  components: {
    dsri: number; // Days Sales in Receivables Index
    gmi: number; // Gross Margin Index
    aqi: number; // Asset Quality Index
    sgi: number; // Sales Growth Index
    depi: number; // Depreciation Index
    sgai: number; // Sales General and Administrative Expenses Index
    tata: number; // Total Accruals to Total Assets
    lvgi: number; // Leverage Index
  };
  formula: {
    constant: number; // -4.84
    dsriCoeff: number; // 0.92 * DSRI
    gmiCoeff: number; // 0.528 * GMI
    aqiCoeff: number; // 0.404 * AQI
    sgiCoeff: number; // 0.892 * SGI
    depiCoeff: number; // 0.115 * DEPI
    sgaiCoeff: number; // -0.172 * SGAI
    tataCoeff: number; // 4.679 * TATA
    lvgiCoeff: number; // -0.327 * LVGI
  };
  calculatedAt: Date;
}

/**
 * Entidad consolidada de todos los scores
 */
export interface ConsolidatedScores {
  ticker: string;
  companyName: string;
  piotroskiScore: PiotroskiScore;
  altmanZScore: AltmanZScore;
  beneishMScore: BeneishMScore;
  overallRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  calculatedAt: Date;
  dataSource: 'API' | 'MANUAL_UPLOAD';
}

/**
 * Entidad para histórico de scores
 */
export interface HistoricalScores {
  ticker: string;
  scores: ConsolidatedScores[];
  trend: {
    piotroskiTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    altmanTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
    beneishTrend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  };
  lastUpdated: Date;
}

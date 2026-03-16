import { FinancialData } from '../entities/financial-data.entity';
import { PiotroskiScore, AltmanZScore, BeneishMScore, ConsolidatedScores } from '../entities/financial-scores.entity';

/**
 * Motor de Valuación - Servicio de dominio para cálculos financieros
 * Implementa los algoritmos de Piotroski F-Score, Altman Z-Score y Beneish M-Score
 */
export class ValuationEngine {
  
  /**
   * Calcula el Piotroski F-Score (0-9)
   * Evalúa la fortaleza financiera en 3 categorías: rentabilidad, apalancamiento y eficiencia
   */
  static calculatePiotroskiFScore(data: FinancialData, previousData?: FinancialData): PiotroskiScore {
    const profitability = {
      positiveNetIncome: data.netIncome > 0 ? 1 : 0,
      positiveOperatingCashFlow: data.operatingCashFlow > 0 ? 1 : 0,
      improvingROA: 0,
      operatingCashFlowVsNetIncome: data.operatingCashFlow > data.netIncome ? 1 : 0,
    };

    const leverage = {
      decreasingLongTermDebt: 0,
      improvingCurrentRatio: 0,
      noNewShares: 0,
    };

    const efficiency = {
      improvingGrossMargin: 0,
      improvingAssetTurnover: 0,
    };

    // Cálculos que requieren datos históricos
    if (previousData) {
      // ROA = Net Income / Total Assets
      const currentROA = this.safeDiv(data.netIncome, data.totalAssets);
      const previousROA = this.safeDiv(previousData.netIncome, previousData.totalAssets);
      profitability.improvingROA = currentROA > previousROA ? 1 : 0;

      // Deuda a largo plazo
      leverage.decreasingLongTermDebt = data.longTermDebt < previousData.longTermDebt ? 1 : 0;

      // Current Ratio = Current Assets / Current Liabilities
      const currentRatio = this.safeDiv(data.currentAssets, data.currentLiabilities);
      const previousCurrentRatio = this.safeDiv(previousData.currentAssets, previousData.currentLiabilities);
      leverage.improvingCurrentRatio = currentRatio > previousCurrentRatio ? 1 : 0;

      // Acciones en circulación
      leverage.noNewShares = data.sharesOutstanding <= previousData.sharesOutstanding ? 1 : 0;

      // Margen bruto = Gross Profit / Revenue
      const currentGrossMargin = this.safeDiv(data.grossProfit, data.revenue);
      const previousGrossMargin = this.safeDiv(previousData.grossProfit, previousData.revenue);
      efficiency.improvingGrossMargin = currentGrossMargin > previousGrossMargin ? 1 : 0;

      // Asset Turnover = Revenue / Total Assets
      const currentAssetTurnover = this.safeDiv(data.revenue, data.totalAssets);
      const previousAssetTurnover = this.safeDiv(previousData.revenue, previousData.totalAssets);
      efficiency.improvingAssetTurnover = currentAssetTurnover > previousAssetTurnover ? 1 : 0;
    }

    const totalScore = 
      profitability.positiveNetIncome +
      profitability.positiveOperatingCashFlow +
      profitability.improvingROA +
      profitability.operatingCashFlowVsNetIncome +
      leverage.decreasingLongTermDebt +
      leverage.improvingCurrentRatio +
      leverage.noNewShares +
      efficiency.improvingGrossMargin +
      efficiency.improvingAssetTurnover;

    return {
      totalScore,
      profitability,
      leverage,
      efficiency,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calcula el Altman Z-Score
   * Predictor de bancarrota empresarial usando 5 ratios financieros
   */
  static calculateAltmanZScore(data: FinancialData, isManufacturing: boolean = true): AltmanZScore {
    // Componentes del Z-Score
    const workingCapitalToTotalAssets = this.safeDiv(data.workingCapital, data.totalAssets);
    const retainedEarningsToTotalAssets = this.safeDiv(data.retainedEarnings, data.totalAssets);
    const ebitToTotalAssets = this.safeDiv(data.ebitda, data.totalAssets); // Usando EBITDA como proxy de EBIT
    const marketValueEquityToBookValueDebt = this.safeDiv(data.marketCap, data.totalLiabilities);
    const salesToTotalAssets = this.safeDiv(data.revenue, data.totalAssets);

    const components = {
      workingCapitalToTotalAssets,
      retainedEarningsToTotalAssets,
      ebitToTotalAssets,
      marketValueEquityToBookValueDebt,
      salesToTotalAssets,
    };

    // Coeficientes según el tipo de empresa
    let coefficients;
    if (isManufacturing) {
      // Modelo original para empresas manufactureras
      coefficients = { A: 1.2, B: 1.4, C: 3.3, D: 0.6, E: 1.0 };
    } else {
      // Modelo modificado para empresas no manufactureras
      coefficients = { A: 6.56, B: 3.26, C: 6.72, D: 1.05, E: 0 };
    }

    const formula = {
      A: coefficients.A * workingCapitalToTotalAssets,
      B: coefficients.B * retainedEarningsToTotalAssets,
      C: coefficients.C * ebitToTotalAssets,
      D: coefficients.D * marketValueEquityToBookValueDebt,
      E: coefficients.E * salesToTotalAssets,
    };

    const totalScore = formula.A + formula.B + formula.C + formula.D + formula.E;

    // Interpretación del score
    let interpretation: 'SAFE' | 'GREY_ZONE' | 'DISTRESS';
    if (isManufacturing) {
      if (totalScore > 2.99) interpretation = 'SAFE';
      else if (totalScore >= 1.8) interpretation = 'GREY_ZONE';
      else interpretation = 'DISTRESS';
    } else {
      if (totalScore > 2.6) interpretation = 'SAFE';
      else if (totalScore >= 1.1) interpretation = 'GREY_ZONE';
      else interpretation = 'DISTRESS';
    }

    return {
      totalScore,
      interpretation,
      components,
      formula,
      isManufacturing,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calcula el Beneish M-Score
   * Detector de manipulación contable usando 8 variables
   */
  static calculateBeneishMScore(data: FinancialData, previousData?: FinancialData): BeneishMScore {
    let components = {
      dsri: 1, // Days Sales in Receivables Index
      gmi: 1, // Gross Margin Index
      aqi: 1, // Asset Quality Index
      sgi: 1, // Sales Growth Index
      depi: 1, // Depreciation Index
      sgai: 1, // Sales General and Administrative Expenses Index
      tata: 0, // Total Accruals to Total Assets
      lvgi: 1, // Leverage Index
    };

    if (previousData) {
      // DSRI = (Receivables/Sales)t / (Receivables/Sales)t-1
      const currentReceivablesRatio = this.safeDiv(data.currentAssets * 0.3, data.revenue); // Aproximación
      const previousReceivablesRatio = this.safeDiv(previousData.currentAssets * 0.3, previousData.revenue);
      components.dsri = this.safeDiv(currentReceivablesRatio, previousReceivablesRatio);

      // GMI = (Gross Margin)t-1 / (Gross Margin)t
      const currentGrossMargin = this.safeDiv(data.grossProfit, data.revenue);
      const previousGrossMargin = this.safeDiv(previousData.grossProfit, previousData.revenue);
      components.gmi = this.safeDiv(previousGrossMargin, currentGrossMargin);

      // AQI = (Non-current assets other than PPE)/Total Assets
      const currentAQI = this.safeDiv(data.totalAssets - data.currentAssets, data.totalAssets);
      const previousAQI = this.safeDiv(previousData.totalAssets - previousData.currentAssets, previousData.totalAssets);
      components.aqi = this.safeDiv(currentAQI, previousAQI);

      // SGI = Sales Growth Index
      components.sgi = this.safeDiv(data.revenue, previousData.revenue);

      // DEPI = Depreciation Index (aproximación)
      const currentDepRate = 0.05; // Aproximación
      const previousDepRate = 0.05;
      components.depi = this.safeDiv(previousDepRate, currentDepRate);

      // SGAI = SG&A Index (aproximación usando operating expenses)
      const currentSGAI = this.safeDiv(data.revenue - data.operatingIncome, data.revenue);
      const previousSGAI = this.safeDiv(previousData.revenue - previousData.operatingIncome, previousData.revenue);
      components.sgai = this.safeDiv(currentSGAI, previousSGAI);

      // LVGI = Leverage Index
      const currentLeverage = this.safeDiv(data.totalLiabilities, data.totalAssets);
      const previousLeverage = this.safeDiv(previousData.totalLiabilities, previousData.totalAssets);
      components.lvgi = this.safeDiv(currentLeverage, previousLeverage);
    }

    // TATA = Total Accruals / Total Assets
    const totalAccruals = data.netIncome - data.operatingCashFlow;
    components.tata = this.safeDiv(totalAccruals, data.totalAssets);

    // Fórmula del M-Score
    const formula = {
      constant: -4.84,
      dsriCoeff: 0.92 * components.dsri,
      gmiCoeff: 0.528 * components.gmi,
      aqiCoeff: 0.404 * components.aqi,
      sgiCoeff: 0.892 * components.sgi,
      depiCoeff: 0.115 * components.depi,
      sgaiCoeff: -0.172 * components.sgai,
      tataCoeff: 4.679 * components.tata,
      lvgiCoeff: -0.327 * components.lvgi,
    };

    const totalScore = 
      formula.constant +
      formula.dsriCoeff +
      formula.gmiCoeff +
      formula.aqiCoeff +
      formula.sgiCoeff +
      formula.depiCoeff +
      formula.sgaiCoeff +
      formula.tataCoeff +
      formula.lvgiCoeff;

    // Interpretación del score
    let interpretation: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK';
    if (totalScore < -2.22) interpretation = 'LOW_RISK';
    else if (totalScore <= -1.78) interpretation = 'MODERATE_RISK';
    else interpretation = 'HIGH_RISK';

    return {
      totalScore,
      interpretation,
      components,
      formula,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calcula todos los scores y genera una evaluación consolidada
   */
  static calculateConsolidatedScores(
    data: FinancialData,
    previousData?: FinancialData,
    isManufacturing: boolean = true,
    dataSource: 'API' | 'MANUAL_UPLOAD' = 'API'
  ): ConsolidatedScores {
    const piotroskiScore = this.calculatePiotroskiFScore(data, previousData);
    const altmanZScore = this.calculateAltmanZScore(data, isManufacturing);
    const beneishMScore = this.calculateBeneishMScore(data, previousData);

    // Evaluación general basada en los tres scores
    const overallRating = this.calculateOverallRating(piotroskiScore, altmanZScore, beneishMScore);
    const riskLevel = this.calculateRiskLevel(altmanZScore, beneishMScore);

    return {
      ticker: data.ticker,
      companyName: data.companyName,
      piotroskiScore,
      altmanZScore,
      beneishMScore,
      overallRating,
      riskLevel,
      calculatedAt: new Date(),
      dataSource,
    };
  }

  /**
   * Calcula la evaluación general basada en los tres scores
   */
  private static calculateOverallRating(
    piotroski: PiotroskiScore,
    altman: AltmanZScore,
    beneish: BeneishMScore
  ): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL' {
    let score = 0;

    // Piotroski F-Score (0-9)
    if (piotroski.totalScore >= 8) score += 3;
    else if (piotroski.totalScore >= 6) score += 2;
    else if (piotroski.totalScore >= 4) score += 1;

    // Altman Z-Score
    if (altman.interpretation === 'SAFE') score += 3;
    else if (altman.interpretation === 'GREY_ZONE') score += 1;

    // Beneish M-Score (invertido - menor score es mejor)
    if (beneish.interpretation === 'LOW_RISK') score += 3;
    else if (beneish.interpretation === 'MODERATE_RISK') score += 1;

    if (score >= 8) return 'EXCELLENT';
    if (score >= 6) return 'GOOD';
    if (score >= 4) return 'FAIR';
    if (score >= 2) return 'POOR';
    return 'CRITICAL';
  }

  /**
   * Calcula el nivel de riesgo basado en Altman y Beneish
   */
  private static calculateRiskLevel(
    altman: AltmanZScore,
    beneish: BeneishMScore
  ): 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (altman.interpretation === 'DISTRESS' || beneish.interpretation === 'HIGH_RISK') {
      return 'CRITICAL';
    }
    if (altman.interpretation === 'GREY_ZONE' && beneish.interpretation === 'MODERATE_RISK') {
      return 'HIGH';
    }
    if (altman.interpretation === 'GREY_ZONE' || beneish.interpretation === 'MODERATE_RISK') {
      return 'MODERATE';
    }
    return 'LOW';
  }

  /**
   * División segura que maneja división por cero
   */
  private static safeDiv(numerator: number, denominator: number): number {
    if (denominator === 0 || denominator === null || denominator === undefined) {
      return 0;
    }
    if (numerator === null || numerator === undefined) {
      return 0;
    }
    return numerator / denominator;
  }
}

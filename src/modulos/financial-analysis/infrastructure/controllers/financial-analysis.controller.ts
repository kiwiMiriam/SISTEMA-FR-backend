import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AnalyzeCompanyUseCase } from '../../application/use-cases/analyze-company.use-case';
import { AnalyzeManualDataUseCase } from '../../application/use-cases/analyze-manual-data.use-case';
import { GetHistoricalAnalysisUseCase } from '../../application/use-cases/get-historical-analysis.use-case';
import { AnalyzeCompanyDto, AnalyzeManualDataDto, HistoricalAnalysisDto } from '../dto/financial-analysis.dto';

/**
 * Controlador principal para análisis financiero
 * Expone endpoints RESTful para el análisis de valor fundamental
 */
@ApiTags('Financial Analysis')
@Controller('api/v1/financial-analysis')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinancialAnalysisController {
  constructor(
    private readonly analyzeCompanyUseCase: AnalyzeCompanyUseCase,
    private readonly analyzeManualDataUseCase: AnalyzeManualDataUseCase,
    private readonly getHistoricalAnalysisUseCase: GetHistoricalAnalysisUseCase,
  ) {}

  /**
   * Endpoint principal: Analiza una empresa por ticker
   * GET /api/v1/financial-analysis/analyze/:ticker
   */
  @Get('analyze/:ticker')
  @ApiOperation({
    summary: 'Analizar empresa por ticker',
    description: 'Obtiene datos financieros y calcula Piotroski F-Score, Altman Z-Score y Beneish M-Score',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis completado exitosamente',
    schema: {
      example: {
        success: true,
        data: {
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          piotroskiScore: {
            totalScore: 8,
            profitability: { positiveNetIncome: 1, positiveOperatingCashFlow: 1 },
            leverage: { decreasingLongTermDebt: 1 },
            efficiency: { improvingGrossMargin: 1 }
          },
          altmanZScore: {
            totalScore: 3.25,
            interpretation: 'SAFE'
          },
          beneishMScore: {
            totalScore: -2.5,
            interpretation: 'LOW_RISK'
          },
          overallRating: 'EXCELLENT',
          riskLevel: 'LOW'
        },
        fromCache: false
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Ticker no encontrado' })
  @ApiResponse({ status: 500, description: 'Error interno del servidor' })
  async analyzeCompany(
    @Param('ticker') ticker: string,
    @Query() query: AnalyzeCompanyDto,
  ) {
    try {
      const result = await this.analyzeCompanyUseCase.execute({
        ticker: ticker.toUpperCase(),
        forceRefresh: query.forceRefresh,
        isManufacturing: query.isManufacturing,
      });

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: result.error,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: result.data,
        fromCache: result.fromCache,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          error: 'Error interno al procesar el análisis',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint para análisis manual (upload de datos)
   * POST /api/v1/financial-analysis/analyze/manual
   */
  @Post('analyze/manual')
  @ApiOperation({
    summary: 'Analizar datos financieros manuales',
    description: 'Permite análisis de empresas que no cotizan en bolsa mediante datos manuales',
  })
  @ApiResponse({
    status: 200,
    description: 'Análisis manual completado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  async analyzeManualData(@Body() analyzeManualDataDto: AnalyzeManualDataDto) {
    try {
      const result = await this.analyzeManualDataUseCase.execute({
        currentData: analyzeManualDataDto.currentData,
        previousData: analyzeManualDataDto.previousData,
        isManufacturing: analyzeManualDataDto.isManufacturing,
        companyName: analyzeManualDataDto.companyName,
        ticker: analyzeManualDataDto.ticker,
      });

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: result.error,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          error: 'Error al procesar datos manuales',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint para subir archivo Excel/CSV
   * POST /api/v1/financial-analysis/upload-report
   */
  @Post('upload-report')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir reporte financiero (Excel/CSV)',
    description: 'Permite subir un archivo Excel o CSV con estados financieros para análisis',
  })
  @ApiResponse({
    status: 200,
    description: 'Archivo procesado y análisis completado',
  })
  @ApiResponse({ status: 400, description: 'Archivo inválido o formato no soportado' })
  async uploadReport(
    @UploadedFile() file: Express.Multer.File,
    @Body() metadata: { companyName?: string; isManufacturing?: boolean },
  ) {
    try {
      if (!file) {
        throw new HttpException(
          {
            success: false,
            error: 'No se proporcionó ningún archivo',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validar tipo de archivo
      const allowedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new HttpException(
          {
            success: false,
            error: 'Tipo de archivo no soportado. Use Excel (.xlsx, .xls) o CSV (.csv)',
            timestamp: new Date().toISOString(),
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      // TODO: Implementar procesamiento de archivo Excel/CSV
      // Por ahora retornamos un placeholder
      return {
        success: true,
        message: 'Funcionalidad de upload en desarrollo',
        fileInfo: {
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          error: 'Error al procesar el archivo',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint para histórico de análisis
   * GET /api/v1/financial-analysis/history/:ticker
   */
  @Get('history/:ticker')
  @ApiOperation({
    summary: 'Obtener histórico de análisis',
    description: 'Compara la evolución de los scores en los últimos trimestres',
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico obtenido exitosamente',
  })
  @ApiResponse({ status: 404, description: 'No se encontró histórico para el ticker' })
  async getHistoricalAnalysis(
    @Param('ticker') ticker: string,
    @Query() query: HistoricalAnalysisDto,
  ) {
    try {
      const result = await this.getHistoricalAnalysisUseCase.execute({
        ticker: ticker.toUpperCase(),
        periods: query.periods,
      });

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            error: result.error,
            timestamp: new Date().toISOString(),
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          error: 'Error al obtener histórico',
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint de salud del servicio
   * GET /api/v1/financial-analysis/health
   */
  @Get('health')
  @ApiOperation({
    summary: 'Verificar estado del servicio',
    description: 'Endpoint para verificar que el servicio de análisis financiero está funcionando',
  })
  async healthCheck() {
    return {
      success: true,
      service: 'Financial Analysis API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

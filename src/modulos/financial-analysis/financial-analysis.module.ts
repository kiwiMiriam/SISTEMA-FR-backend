import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import * as redisStore from 'cache-manager-redis-store';

// Controllers
import { FinancialAnalysisController } from './infrastructure/controllers/financial-analysis.controller';

// Use Cases
import { AnalyzeCompanyUseCase } from './application/use-cases/analyze-company.use-case';
import { AnalyzeManualDataUseCase } from './application/use-cases/analyze-manual-data.use-case';
import { GetHistoricalAnalysisUseCase } from './application/use-cases/get-historical-analysis.use-case';

// Infrastructure Services
import { CacheService } from './infrastructure/services/cache.service';
import { FinancialModelingPrepAdapter } from './infrastructure/adapters/financial-modeling-prep.adapter';

// Repository Implementations
import { FinancialDataRepositoryImpl } from './infrastructure/repositories/financial-data.repository.impl';
import { FinancialScoresRepositoryImpl } from './infrastructure/repositories/financial-scores.repository.impl';

// Repository Interfaces (Tokens)
import { IFinancialDataRepository, IFinancialScoresRepository } from './domain/repositories/financial-data.repository';

/**
 * Módulo principal de análisis financiero
 * Implementa arquitectura hexagonal con separación clara de responsabilidades
 */
@Module({
  imports: [
    ConfigModule,
    
    // Configuración de caché Redis
    CacheModule.register({
      store: redisStore,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      ttl: 86400, // 24 horas por defecto
      max: 1000, // Máximo 1000 elementos en caché
    }),

    // Rate limiting para APIs externas
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 3, // 3 requests por segundo
      },
      {
        name: 'medium',
        ttl: 10000, // 10 segundos
        limit: 20, // 20 requests por 10 segundos
      },
      {
        name: 'long',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requests por minuto
      },
    ]),
  ],

  controllers: [
    FinancialAnalysisController,
  ],

  providers: [
    // Use Cases (Application Layer)
    AnalyzeCompanyUseCase,
    AnalyzeManualDataUseCase,
    GetHistoricalAnalysisUseCase,

    // Infrastructure Services
    CacheService,
    FinancialModelingPrepAdapter,

    // Repository Implementations
    FinancialDataRepositoryImpl,
    FinancialScoresRepositoryImpl,

    // Repository Interface Bindings (Dependency Injection)
    {
      provide: 'IFinancialDataRepository',
      useClass: FinancialDataRepositoryImpl,
    },
    {
      provide: 'IFinancialScoresRepository',
      useClass: FinancialScoresRepositoryImpl,
    },

    // External API Adapter Binding
    {
      provide: 'ExternalFinancialDataProvider',
      useClass: FinancialModelingPrepAdapter,
    },
  ],

  exports: [
    // Exportar servicios que puedan ser usados por otros módulos
    AnalyzeCompanyUseCase,
    AnalyzeManualDataUseCase,
    GetHistoricalAnalysisUseCase,
    CacheService,
    'IFinancialDataRepository',
    'IFinancialScoresRepository',
  ],
})
export class FinancialAnalysisModule {}

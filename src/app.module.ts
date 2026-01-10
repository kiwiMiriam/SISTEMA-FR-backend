import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import * as entities from './entities';
import { AuthModule } from './modulos/auth/auth.module';
import { UsersModule } from './modulos/users/users.module';
import { ProductosModule } from './modulos/productos/productos.module';
import { ClientesModule } from './modulos/clientes/clientes.module';
import { VentasModule } from './modulos/ventas/ventas.module';
import { PromocionesModule } from './modulos/promociones/promociones.module';
import { CajaModule } from './modulos/caja/caja.module';
import { GastosModule } from './modulos/gastos/gastos.module';
import { DeliveryModule } from './modulos/delivery/delivery.module';
import { MovimientoInventarioModule } from './modulos/movimiento-inventario/movimiento-inventario.module';
import { WhatsappModule } from './modulos/whatsapp/whatsapp.module';
import { ExcelModule } from './modulos/excel/excel.module';
import { SeederModule } from './database/seeders/seeder.module';
import { AdminModule } from './modulos/admin/admin.module';
// Nuevos módulos de refactorización arquitectónica
import { PuntosModule } from './modulos/puntos/puntos.module';
import { EntradasModule } from './modulos/entradas/entradas.module';
import { CorteModule } from './modulos/corte/corte.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ): TypeOrmModuleOptions => {
        console.log('DATABASE_URL:', process.env.DATABASE_URL);
        const databaseUrl = process.env.DATABASE_URL;

        const baseConfig: TypeOrmModuleOptions = {
          type: 'postgres',
          autoLoadEntities: true,
          synchronize: configService.get<boolean>('database.synchronize'),
          logging: configService.get<boolean>('database.logging'),
        };

        // 👉 Producción (Railway / Neon / Supabase / Render)
        if (databaseUrl) {
          return {
            ...baseConfig,
            url: databaseUrl,
            ssl: {
              rejectUnauthorized: false,
            },
          };
        }

        // 👉 Local
        return {
          ...baseConfig,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
        };
      },
    }),

    AuthModule,
    UsersModule,
    ProductosModule,
    ClientesModule,
    VentasModule,
    PromocionesModule,
    CajaModule,
    GastosModule,
    DeliveryModule,
    MovimientoInventarioModule,
    WhatsappModule,
    ExcelModule,
    SeederModule,
    AdminModule,
    // Nuevos módulos de refactorización arquitectónica
    PuntosModule,
    EntradasModule,
    CorteModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

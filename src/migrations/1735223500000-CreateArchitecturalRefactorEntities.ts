import { MigrationInterface, QueryRunner, Table, Index, ForeignKey } from 'typeorm';

export class CreateArchitecturalRefactorEntities1735223500000 implements MigrationInterface {
  name = 'CreateArchitecturalRefactorEntities1735223500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear enum para tipos de movimiento de puntos
    await queryRunner.query(`
      CREATE TYPE "tipo_movimiento_puntos_enum" AS ENUM('ACUMULACION', 'CANJE', 'REVERSO', 'AJUSTE')
    `);

    // Crear tabla cliente_puntos_movimientos
    await queryRunner.createTable(
      new Table({
        name: 'cliente_puntos_movimientos',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'cliente_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'tipo',
            type: 'tipo_movimiento_puntos_enum',
            isNullable: false,
            comment: 'ACUMULACION: ganó puntos, CANJE: usó puntos, REVERSO: anulación, AJUSTE: corrección manual',
          },
          {
            name: 'puntos',
            type: 'int',
            isNullable: false,
            comment: 'Cantidad de puntos (positivo para ACUMULACION, negativo para CANJE/REVERSO)',
          },
          {
            name: 'valor_monetario',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
            comment: 'Valor monetario equivalente del movimiento',
          },
          {
            name: 'motivo',
            type: 'varchar',
            length: '500',
            isNullable: false,
            comment: 'Descripción del motivo del movimiento',
          },
          {
            name: 'venta_id',
            type: 'int',
            isNullable: true,
            comment: 'ID de la venta relacionada (si aplica)',
          },
          {
            name: 'registrado_por',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Usuario que registró el movimiento',
          },
          {
            name: 'saldo_anterior',
            type: 'int',
            isNullable: false,
            comment: 'Saldo de puntos antes de este movimiento',
          },
          {
            name: 'saldo_posterior',
            type: 'int',
            isNullable: false,
            comment: 'Saldo de puntos después de este movimiento',
          },
          {
            name: 'fecha_movimiento',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Crear tabla entradas
    await queryRunner.createTable(
      new Table({
        name: 'entradas',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'monto',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
            comment: 'Monto del ingreso',
          },
          {
            name: 'descripcion',
            type: 'varchar',
            length: '500',
            isNullable: false,
            comment: 'Descripción detallada del ingreso',
          },
          {
            name: 'categoria',
            type: 'varchar',
            length: '100',
            isNullable: true,
            comment: 'Categoría del ingreso (ej: DONACION, SERVICIO, REEMBOLSO)',
          },
          {
            name: 'registrado_por',
            type: 'varchar',
            length: '100',
            isNullable: false,
            comment: 'Usuario que registró el ingreso',
          },
          {
            name: 'fecha',
            type: 'date',
            isNullable: false,
            comment: 'Fecha del ingreso',
          },
          {
            name: 'observaciones',
            type: 'varchar',
            length: '1000',
            isNullable: true,
            comment: 'Observaciones adicionales',
          },
          {
            name: 'fecha_creacion',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'fecha_actualizacion',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Crear índices para cliente_puntos_movimientos
    await queryRunner.query(`
      CREATE INDEX "IDX_cliente_puntos_movimientos_cliente_fecha" 
      ON "cliente_puntos_movimientos" ("cliente_id", "fecha_movimiento")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cliente_puntos_movimientos_tipo_fecha" 
      ON "cliente_puntos_movimientos" ("tipo", "fecha_movimiento")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cliente_puntos_movimientos_venta" 
      ON "cliente_puntos_movimientos" ("venta_id")
    `);

    // Crear índices para entradas
    await queryRunner.query(`
      CREATE INDEX "IDX_entradas_fecha" ON "entradas" ("fecha")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_entradas_registrado_por" ON "entradas" ("registrado_por")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_entradas_categoria" ON "entradas" ("categoria")
    `);

    // Crear foreign keys para cliente_puntos_movimientos
    await queryRunner.query(`
      ALTER TABLE "cliente_puntos_movimientos" 
      ADD CONSTRAINT "FK_cliente_puntos_movimientos_cliente" 
      FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "cliente_puntos_movimientos" 
      ADD CONSTRAINT "FK_cliente_puntos_movimientos_venta" 
      FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL
    `);

    console.log('✅ Entidades de refactorización arquitectónica creadas exitosamente');
    console.log('📊 Tabla cliente_puntos_movimientos: Separación ANULACIÓN ≠ CANJE');
    console.log('💰 Tabla entradas: Ingresos no relacionados con ventas');
    console.log('🔧 Índices optimizados para consultas de corte y reportes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar foreign keys
    await queryRunner.query(`ALTER TABLE "cliente_puntos_movimientos" DROP CONSTRAINT "FK_cliente_puntos_movimientos_cliente"`);
    await queryRunner.query(`ALTER TABLE "cliente_puntos_movimientos" DROP CONSTRAINT "FK_cliente_puntos_movimientos_venta"`);

    // Eliminar índices
    await queryRunner.query(`DROP INDEX "IDX_cliente_puntos_movimientos_cliente_fecha"`);
    await queryRunner.query(`DROP INDEX "IDX_cliente_puntos_movimientos_tipo_fecha"`);
    await queryRunner.query(`DROP INDEX "IDX_cliente_puntos_movimientos_venta"`);
    await queryRunner.query(`DROP INDEX "IDX_entradas_fecha"`);
    await queryRunner.query(`DROP INDEX "IDX_entradas_registrado_por"`);
    await queryRunner.query(`DROP INDEX "IDX_entradas_categoria"`);

    // Eliminar tablas
    await queryRunner.dropTable('entradas');
    await queryRunner.dropTable('cliente_puntos_movimientos');

    // Eliminar enum
    await queryRunner.query(`DROP TYPE "tipo_movimiento_puntos_enum"`);
  }
}


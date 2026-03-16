import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateFinancialScoresTable1773704164000 implements MigrationInterface {
  name = 'CreateFinancialScoresTable1773704164000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'financial_scores',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'ticker',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'companyName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'piotroskiTotalScore',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'piotroskiData',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'altmanTotalScore',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'altmanInterpretation',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'altmanData',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'beneishTotalScore',
            type: 'decimal',
            precision: 10,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'beneishInterpretation',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'beneishData',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'overallRating',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'riskLevel',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'dataSource',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'calculatedAt',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Crear índices para optimizar consultas
    await queryRunner.createIndex(
      'financial_scores',
      new Index({
        name: 'IDX_financial_scores_ticker_calculated_at',
        columnNames: ['ticker', 'calculatedAt'],
      }),
    );

    await queryRunner.createIndex(
      'financial_scores',
      new Index({
        name: 'IDX_financial_scores_overall_rating',
        columnNames: ['overallRating'],
      }),
    );

    await queryRunner.createIndex(
      'financial_scores',
      new Index({
        name: 'IDX_financial_scores_risk_level',
        columnNames: ['riskLevel'],
      }),
    );

    await queryRunner.createIndex(
      'financial_scores',
      new Index({
        name: 'IDX_financial_scores_calculated_at',
        columnNames: ['calculatedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar índices
    await queryRunner.dropIndex('financial_scores', 'IDX_financial_scores_ticker_calculated_at');
    await queryRunner.dropIndex('financial_scores', 'IDX_financial_scores_overall_rating');
    await queryRunner.dropIndex('financial_scores', 'IDX_financial_scores_risk_level');
    await queryRunner.dropIndex('financial_scores', 'IDX_financial_scores_calculated_at');

    // Eliminar tabla
    await queryRunner.dropTable('financial_scores');
  }
}

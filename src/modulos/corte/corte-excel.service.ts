import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { CorteService, ResumenCorte } from './corte.service';

/**
 * Servicio para generar reportes Excel del corte de caja
 */
@Injectable()
export class CorteExcelService {
  constructor(private readonly corteService: CorteService) {}

  /**
   * Genera archivo Excel completo del corte de caja
   * @param fechaInicio Fecha de inicio
   * @param fechaFin Fecha de fin
   * @returns Buffer del archivo Excel
   */
  async generarCorteExcel(fechaInicio: Date, fechaFin: Date): Promise<Buffer> {
    // Obtener datos del corte
    const corte = await this.corteService.calcularCorteCompleto(fechaInicio, fechaFin);

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema POS Francachela';
    workbook.created = new Date();

    // Crear hojas
    await this.crearHojaResumen(workbook, corte);
    await this.crearHojaVentas(workbook, corte);
    await this.crearHojaEntradas(workbook, corte);
    await this.crearHojaGastos(workbook, corte);

    // Generar buffer
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Crea la hoja de resumen general
   */
  private async crearHojaResumen(workbook: ExcelJS.Workbook, corte: ResumenCorte) {
    const worksheet = workbook.addWorksheet('Resumen General');

    // Configurar columnas
    worksheet.columns = [
      { header: 'Concepto', key: 'concepto', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
      { header: 'Formato', key: 'formato', width: 20 },
    ];

    // Título principal
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `CORTE DE CAJA - ${corte.periodo.fechaInicio} al ${corte.periodo.fechaFin}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };

    // Espacio
    worksheet.addRow([]);

    // Sección INGRESOS
    this.agregarSeccion(worksheet, 'INGRESOS', 'FF70AD47');
    
    worksheet.addRow([
      'Ventas - Cantidad',
      corte.ventas.cantidad,
      `${corte.ventas.cantidad} ventas`
    ]);
    
    worksheet.addRow([
      'Ventas - Total Bruto',
      corte.ventas.totalBruto,
      `S/ ${corte.ventas.totalBruto.toFixed(2)}`
    ]);
    
    worksheet.addRow([
      'Ventas - Ajustes Redondeo',
      corte.ventas.ajustesRedondeo,
      `S/ ${corte.ventas.ajustesRedondeo.toFixed(2)}`
    ]);
    
    worksheet.addRow([
      'Ventas - Total Cobrado',
      corte.ventas.totalCobrado,
      `S/ ${corte.ventas.totalCobrado.toFixed(2)}`
    ]);

    worksheet.addRow([
      'Entradas - Cantidad',
      corte.entradas.cantidad,
      `${corte.entradas.cantidad} entradas`
    ]);
    
    worksheet.addRow([
      'Entradas - Total',
      corte.entradas.total,
      `S/ ${corte.entradas.total.toFixed(2)}`
    ]);

    worksheet.addRow([
      'TOTAL INGRESOS',
      corte.rentabilidad.ingresosTotales,
      `S/ ${corte.rentabilidad.ingresosTotales.toFixed(2)}`
    ]).font = { bold: true };

    // Espacio
    worksheet.addRow([]);

    // Sección EGRESOS
    this.agregarSeccion(worksheet, 'EGRESOS', 'FFE74C3C');
    
    worksheet.addRow([
      'Gastos - Cantidad',
      corte.gastos.cantidad,
      `${corte.gastos.cantidad} gastos`
    ]);
    
    worksheet.addRow([
      'Gastos - Total',
      corte.gastos.total,
      `S/ ${corte.gastos.total.toFixed(2)}`
    ]);

    worksheet.addRow([
      'TOTAL EGRESOS',
      corte.rentabilidad.gastosTotales,
      `S/ ${corte.rentabilidad.gastosTotales.toFixed(2)}`
    ]).font = { bold: true };

    // Espacio
    worksheet.addRow([]);

    // Sección RENTABILIDAD
    this.agregarSeccion(worksheet, 'RENTABILIDAD', 'FF9B59B6');
    
    worksheet.addRow([
      'Utilidad Neta',
      corte.rentabilidad.utilidadNeta,
      `S/ ${corte.rentabilidad.utilidadNeta.toFixed(2)}`
    ]).font = { bold: true };
    
    worksheet.addRow([
      'Margen de Utilidad',
      corte.rentabilidad.margenUtilidad,
      `${corte.rentabilidad.margenUtilidad.toFixed(2)}%`
    ]);

    // Espacio
    worksheet.addRow([]);

    // Métodos de pago
    this.agregarSeccion(worksheet, 'MÉTODOS DE PAGO', 'FF17A2B8');
    
    Object.entries(corte.ventas.desglosePorMetodo).forEach(([metodo, monto]) => {
      worksheet.addRow([
        metodo,
        monto,
        `S/ ${monto.toFixed(2)}`
      ]);
    });

    // Aplicar estilos
    this.aplicarEstilosGenerales(worksheet);
  }

  /**
   * Crea la hoja de detalle de ventas
   */
  private async crearHojaVentas(workbook: ExcelJS.Workbook, corte: ResumenCorte) {
    const worksheet = workbook.addWorksheet('Detalle Ventas');

    // Headers
    worksheet.columns = [
      { header: 'Concepto', key: 'concepto', width: 25 },
      { header: 'Cantidad', key: 'cantidad', width: 15 },
      { header: 'Monto', key: 'monto', width: 20 },
    ];

    // Título
    worksheet.mergeCells('A1:C1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'DETALLE DE VENTAS';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Datos de ventas
    worksheet.addRow(['Total de Ventas', corte.ventas.cantidad, `S/ ${corte.ventas.totalBruto.toFixed(2)}`]);
    worksheet.addRow(['Ajustes de Redondeo', '', `S/ ${corte.ventas.ajustesRedondeo.toFixed(2)}`]);
    worksheet.addRow(['Total Cobrado', '', `S/ ${corte.ventas.totalCobrado.toFixed(2)}`]);

    worksheet.addRow([]);

    // Métodos de pago
    worksheet.addRow(['MÉTODOS DE PAGO', '', '']);
    Object.entries(corte.ventas.desglosePorMetodo).forEach(([metodo, monto]) => {
      worksheet.addRow([metodo, '', `S/ ${monto.toFixed(2)}`]);
    });

    this.aplicarEstilosGenerales(worksheet);
  }

  /**
   * Crea la hoja de detalle de entradas
   */
  private async crearHojaEntradas(workbook: ExcelJS.Workbook, corte: ResumenCorte) {
    const worksheet = workbook.addWorksheet('Detalle Entradas');

    worksheet.columns = [
      { header: 'Categoría', key: 'categoria', width: 25 },
      { header: 'Monto', key: 'monto', width: 20 },
    ];

    // Título
    worksheet.mergeCells('A1:B1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'DETALLE DE ENTRADAS';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Total general
    worksheet.addRow(['TOTAL ENTRADAS', `S/ ${corte.entradas.total.toFixed(2)}`]);
    worksheet.addRow(['Cantidad de Entradas', corte.entradas.cantidad]);

    worksheet.addRow([]);

    // Por categoría
    worksheet.addRow(['POR CATEGORÍA', '']);
    Object.entries(corte.entradas.porCategoria).forEach(([categoria, monto]) => {
      worksheet.addRow([categoria, `S/ ${monto.toFixed(2)}`]);
    });

    this.aplicarEstilosGenerales(worksheet);
  }

  /**
   * Crea la hoja de detalle de gastos
   */
  private async crearHojaGastos(workbook: ExcelJS.Workbook, corte: ResumenCorte) {
    const worksheet = workbook.addWorksheet('Detalle Gastos');

    worksheet.columns = [
      { header: 'Categoría', key: 'categoria', width: 25 },
      { header: 'Monto', key: 'monto', width: 20 },
    ];

    // Título
    worksheet.mergeCells('A1:B1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'DETALLE DE GASTOS';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    // Total general
    worksheet.addRow(['TOTAL GASTOS', `S/ ${corte.gastos.total.toFixed(2)}`]);
    worksheet.addRow(['Cantidad de Gastos', corte.gastos.cantidad]);

    worksheet.addRow([]);

    // Por categoría
    worksheet.addRow(['POR CATEGORÍA', '']);
    Object.entries(corte.gastos.porCategoria).forEach(([categoria, monto]) => {
      worksheet.addRow([categoria, `S/ ${monto.toFixed(2)}`]);
    });

    this.aplicarEstilosGenerales(worksheet);
  }

  /**
   * Agrega una sección con estilo
   */
  private agregarSeccion(worksheet: ExcelJS.Worksheet, titulo: string, color: string) {
    const row = worksheet.addRow([titulo, '', '']);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color }
    };
    worksheet.mergeCells(`A${row.number}:C${row.number}`);
  }

  /**
   * Aplica estilos generales a la hoja
   */
  private aplicarEstilosGenerales(worksheet: ExcelJS.Worksheet) {
    // Estilo para headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7E6E6' }
    };

    // Bordes para todas las celdas con datos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 0) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Formato de números para columnas de montos
    worksheet.getColumn('valor').numFmt = '#,##0.00';
    worksheet.getColumn('monto').numFmt = '#,##0.00';
  }
}

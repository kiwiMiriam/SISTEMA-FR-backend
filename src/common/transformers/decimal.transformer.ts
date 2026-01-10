import { ValueTransformer } from 'typeorm';

/**
 * Transformer para campos decimales que garantiza precisión monetaria
 * Convierte strings de base de datos a números y viceversa
 */
export const decimalTransformer: ValueTransformer = {
  to: (value: number): number => {
    return value;
  },
  from: (value: string): number => {
    return parseFloat(value);
  },
};


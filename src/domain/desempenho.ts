export const LIMIAR_PADRAO = 60;

export interface Desempenho {
  nota: number;
  precisaMonitoria: boolean;
}

export function avaliarDesempenho(nota: number, limiar: number = LIMIAR_PADRAO): Desempenho {
  if (!Number.isFinite(nota) || nota < 0 || nota > 100) {
    throw new RangeError('Nota deve estar entre 0 e 100.');
  }
  return { nota, precisaMonitoria: nota < limiar };
}
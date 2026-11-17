export const TOLERANCIA_MS = 30_000; // folga para latência de rede

/** Prazo estourado, já contando a folga. */
export function prazoEstourado(prazoEm: Date, agora: number = Date.now()): boolean {
  return agora > prazoEm.getTime() + TOLERANCIA_MS;
}

/** Tentativas com prazoEm ESTRITAMENTE anterior a este instante não podem mais ser finalizadas. */
export function limiteDeExpiracao(agora: number = Date.now()): Date {
  return new Date(agora - TOLERANCIA_MS);
}

export function segundosRestantes(prazoEm: Date, agora: number = Date.now()): number {
  return Math.max(0, Math.floor((prazoEm.getTime() - agora) / 1000));
}
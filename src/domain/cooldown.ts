export function criarCooldown(janelaMs: number, maxEntradas = 5_000) {
  const ultimos = new Map<string, number>();
  return {
    liberar(chave: string, agora: number = Date.now()): boolean {
      const anterior = ultimos.get(chave);
      if (anterior !== undefined && agora - anterior < janelaMs) return false;
      if (ultimos.size >= maxEntradas) {
        for (const [k, t] of ultimos) if (agora - t >= janelaMs) ultimos.delete(k);
      }
      ultimos.set(chave, agora);
      return true;
    },
    tamanho: () => ultimos.size,
  };
}
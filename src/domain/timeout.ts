export function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    temporizador = setTimeout(() => rejeitar(new Error('timeout')), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}
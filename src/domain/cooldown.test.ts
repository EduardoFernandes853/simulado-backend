import { criarCooldown } from './cooldown';

describe('criarCooldown', () => {
  it('libera a primeira vez e bloqueia dentro da janela', () => {
    const c = criarCooldown(60_000);
    expect(c.liberar('a@x.com', 1_000)).toBe(true);
    expect(c.liberar('a@x.com', 30_000)).toBe(false);
  });

  it('libera de novo depois da janela', () => {
    const c = criarCooldown(60_000);
    c.liberar('a@x.com', 1_000);
    expect(c.liberar('a@x.com', 61_001)).toBe(true);
  });

  it('chaves diferentes não se atrapalham', () => {
    const c = criarCooldown(60_000);
    c.liberar('a@x.com', 1_000);
    expect(c.liberar('b@x.com', 2_000)).toBe(true);
  });

  it('um pedido bloqueado não estende a janela', () => {
    const c = criarCooldown(60_000);
    c.liberar('a@x.com', 0);
    c.liberar('a@x.com', 50_000);
    expect(c.liberar('a@x.com', 60_001)).toBe(true);
  });

  it('descarta entradas vencidas para não crescer sem limite', () => {
    const c = criarCooldown(1_000, 3);
    ['a', 'b', 'c'].forEach((k, i) => c.liberar(k, i));
    c.liberar('d', 10_000);
    expect(c.tamanho()).toBe(1);
  });
});
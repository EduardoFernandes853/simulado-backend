import { TOLERANCIA_MS, limiteDeExpiracao, prazoEstourado, segundosRestantes } from './prazo';

const T0 = new Date('2026-11-16T12:00:00.000Z');

describe('prazoEstourado', () => {
  it('não estoura antes do prazo', () => expect(prazoEstourado(T0, T0.getTime() - 1)).toBe(false));
  it('não estoura dentro da tolerância, nem no limite exato', () =>
    expect(prazoEstourado(T0, T0.getTime() + TOLERANCIA_MS)).toBe(false));
  it('estoura 1 ms depois da tolerância', () =>
    expect(prazoEstourado(T0, T0.getTime() + TOLERANCIA_MS + 1)).toBe(true));
});

describe('limiteDeExpiracao', () => {
  it('é "agora" menos a tolerância', () =>
    expect(limiteDeExpiracao(T0.getTime()).getTime()).toBe(T0.getTime() - TOLERANCIA_MS));
  it.each([-1, 0, TOLERANCIA_MS, TOLERANCIA_MS + 1, TOLERANCIA_MS + 5000])(
    'concorda com prazoEstourado quando agora = prazo + %p ms',
    (delta) => {
      const agora = T0.getTime() + delta;
      expect(T0.getTime() < limiteDeExpiracao(agora).getTime()).toBe(prazoEstourado(T0, agora));
    },
  );
});

describe('segundosRestantes', () => {
  it('arredonda para baixo', () => expect(segundosRestantes(new Date(T0.getTime() + 90_900), T0.getTime())).toBe(90));
  it('nunca é negativo', () => expect(segundosRestantes(T0, T0.getTime() + 10_000)).toBe(0));
});
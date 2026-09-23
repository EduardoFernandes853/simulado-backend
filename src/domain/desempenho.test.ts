import { avaliarDesempenho } from './desempenho';

describe('avaliarDesempenho', () => {
  it.each([
    [0, true],
    [59.99, true],
    [60, false],
    [100, false],
  ])('nota %p → precisaMonitoria %p', (nota, esperado) => {
    expect(avaliarDesempenho(nota).precisaMonitoria).toBe(esperado);
  });

  it('respeita um limiar customizado', () => {
    expect(avaliarDesempenho(70, 75).precisaMonitoria).toBe(true);
    expect(avaliarDesempenho(75, 75).precisaMonitoria).toBe(false);
  });

  it.each([[-1], [100.01], [NaN], [Infinity]])('rejeita nota inválida %p', (nota) => {
    expect(() => avaliarDesempenho(nota)).toThrow(RangeError);
  });
});
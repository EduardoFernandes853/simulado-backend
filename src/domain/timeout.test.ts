import { comTimeout } from './timeout';

describe('comTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devolve o valor quando a promessa resolve a tempo', async () => {
    await expect(comTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it('rejeita depois do prazo quando a promessa não resolve', async () => {
    const resultado = comTimeout(new Promise<number>(() => {}), 1000);
    const esperado = expect(resultado).rejects.toThrow('timeout');
    jest.advanceTimersByTime(1000);
    await esperado;
  });

  it('propaga o erro da própria promessa', async () => {
    await expect(comTimeout(Promise.reject(new Error('falhou')), 1000)).rejects.toThrow('falhou');
  });

  it('não deixa temporizadores pendentes', async () => {
    await comTimeout(Promise.resolve(1), 1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
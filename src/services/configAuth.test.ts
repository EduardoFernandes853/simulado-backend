import { cadastroPublicoFechado, limparCacheConfigAuth } from './configAuth';

const resposta = (corpo: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => corpo }) as unknown as Response;
const comFetch = (f: jest.Mock) => f as unknown as typeof fetch;

let avisar: jest.SpyInstance;
let falhar: jest.SpyInstance;

beforeEach(() => {
  limparCacheConfigAuth();
  avisar = jest.spyOn(console, 'warn').mockImplementation(() => {});
  falhar = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  avisar.mockRestore();
  falhar.mockRestore();
});

describe('cadastroPublicoFechado', () => {
  it('true quando o Supabase informa disable_signup = true', async () => {
    const f = jest.fn().mockResolvedValue(resposta({ disable_signup: true }));
    expect(await cadastroPublicoFechado(comFetch(f))).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toMatch(/\/auth\/v1\/settings$/);
    expect(init.headers.apikey).toBeTruthy();
  });

  it('false e registra erro quando o cadastro público está aberto', async () => {
    const f = jest.fn().mockResolvedValue(resposta({ disable_signup: false }));
    expect(await cadastroPublicoFechado(comFetch(f))).toBe(false);
    expect(falhar).toHaveBeenCalled();
  });

  it.each([
    ['campo ausente', () => resposta({})],
    ['HTTP 500', () => resposta({}, false, 500)],
  ])('na dúvida (%s) não bloqueia, avisa no log e não guarda em cache', async (_nome, criar) => {
    const f = jest.fn().mockResolvedValue(criar());
    expect(await cadastroPublicoFechado(comFetch(f))).toBe(true);
    expect(await cadastroPublicoFechado(comFetch(f))).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(avisar).toHaveBeenCalled();
  });

  it('falha de rede também não bloqueia', async () => {
    const f = jest.fn().mockRejectedValue(new Error('timeout'));
    expect(await cadastroPublicoFechado(comFetch(f))).toBe(true);
    expect(avisar).toHaveBeenCalled();
  });

  it('guarda o resultado por 10 minutos', async () => {
    const f = jest.fn().mockResolvedValue(resposta({ disable_signup: true }));
    await cadastroPublicoFechado(comFetch(f), 0);
    await cadastroPublicoFechado(comFetch(f), 9 * 60_000);
    expect(f).toHaveBeenCalledTimes(1);
    await cadastroPublicoFechado(comFetch(f), 11 * 60_000);
    expect(f).toHaveBeenCalledTimes(2);
  });
});
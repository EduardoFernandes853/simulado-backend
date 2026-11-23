import { config } from './config';
import { registrarErro } from './observabilidade';

const mockCapturar = jest.fn();
jest.mock('@sentry/node', () => ({ captureException: (...a: unknown[]) => mockCapturar(...a) }));

const dsnOriginal = config.SENTRY_DSN;
afterEach(() => {
  config.SENTRY_DSN = dsnOriginal;
  mockCapturar.mockClear();
});

describe('registrarErro', () => {
  it('sem DSN não envia nada (desenvolvimento e testes)', () => {
    config.SENTRY_DSN = undefined;
    registrarErro(new Error('x'));
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it('com DSN envia o erro ao Sentry', () => {
    config.SENTRY_DSN = 'https://chave@o1.ingest.sentry.io/1';
    const erro = new Error('x');
    registrarErro(erro);
    expect(mockCapturar).toHaveBeenCalledWith(erro);
  });
});
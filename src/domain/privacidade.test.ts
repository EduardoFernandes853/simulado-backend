import { limparEvento, limparEventoOuDescartar, mascarar, urlSemSegredos } from './privacidade';

describe('mascarar', () => {
  it.each([
    ['falha para 202438305315@aluno.ifpa.edu.br', 'falha para [e-mail]'],
    ['matrícula 202438305315 inválida', 'matrícula [número] inválida'],
    ['Bearer eyJhbGciOi.eyJzdWIiOiIx.assinatura_x-y', 'Bearer [token]'],
    ['#access_token=SEGREDO&type=invite', '#access_token=[removido]&type=invite'],
    ['code=abc123&state=x', 'code=[removido]&state=x'],
    ['senha=minhasenha1', 'senha=[removido]'],
    ['servidor na porta 10000', 'servidor na porta 10000'],
    ['sem dados pessoais', 'sem dados pessoais'],
  ])('%p', (entrada, esperado) => expect(mascarar(entrada)).toBe(esperado));
});

describe('urlSemSegredos', () => {
  it.each([
    ['https://app.vercel.app/#access_token=SEGREDO&type=invite', 'https://app.vercel.app/'],
    ['https://app.vercel.app/?code=abc#x', 'https://app.vercel.app/'],
    ['/tentativas/abc?x=1', '/tentativas/abc'],
    ['https://api.exemplo.com/health', 'https://api.exemplo.com/health'],
  ])('%p', (entrada, esperado) => expect(urlSemSegredos(entrada)).toBe(esperado));
});

describe('limparEvento', () => {
  const base = () => ({
    level: 'error',
    tags: { origem: 'teste' },
    user: { id: 'u-1', email: 'a@b.com', username: 'maria', ip_address: '1.2.3.4' },
    request: {
      url: 'https://app.vercel.app/#access_token=SEGREDO&refresh_token=OUTRO',
      method: 'POST',
      headers: { Authorization: 'Bearer x', Cookie: 'a=b' },
      cookies: { a: 'b' },
      data: { respostas: ['A', 'B'] },
      query_string: 'code=1',
      env: { REMOTE_ADDR: '1.2.3.4' },
    },
    extra: { qualquer: 'coisa' },
    message: 'Falha com 202438305315@aluno.ifpa.edu.br',
    exception: {
      values: [{ type: 'Error', value: 'matrícula 202438305315', stacktrace: { frames: [{ filename: 'a.js' }] } }],
    },
    breadcrumbs: [
      { category: 'navigation', data: { from: '/a?x=1', to: 'https://app.vercel.app/#access_token=SEGREDO' } },
      { category: 'fetch', data: { url: 'https://api.exemplo.com/cadastro?email=a@b.com', method: 'POST', status_code: 202 } },
      { category: 'console', message: 'falha para maria@aluno.ifpa.edu.br' },
    ],
  });

  it('remove cabeçalhos, cookies, corpo, query string e ambiente da requisição', () => {
    const r = limparEvento(base()).request as Record<string, unknown>;
    for (const campo of ['headers', 'cookies', 'data', 'query_string', 'env']) expect(r).not.toHaveProperty(campo);
    expect(r.method).toBe('POST');
  });

  it('tira query e fragmento da URL da requisição (tokens de convite e recuperação)', () => {
    expect((limparEvento(base()).request as { url: string }).url).toBe('https://app.vercel.app/');
  });

  it('do usuário, guarda só o id', () => {
    expect(limparEvento(base()).user).toEqual({ id: 'u-1' });
  });

  it('remove o usuário quando não há id', () => {
    const e = base();
    e.user = { id: '', email: 'a@b.com', username: 'x', ip_address: '1.1.1.1' };
    expect(limparEvento(e)).not.toHaveProperty('user');
  });

  it('mascara e-mail e matrícula na mensagem e na exceção', () => {
    const e = limparEvento(base());
    expect(e.message).toBe('Falha com [e-mail]');
    expect(e.exception.values[0].value).toBe('matrícula [número]');
  });

  it('preserva o que serve para depurar: tipo, rastro, nível e etiquetas', () => {
    const e = limparEvento(base());
    expect(e.exception.values[0].type).toBe('Error');
    expect(e.exception.values[0].stacktrace).toEqual({ frames: [{ filename: 'a.js' }] });
    expect(e.level).toBe('error');
    expect(e.tags).toEqual({ origem: 'teste' });
  });

  it('limpa os rastros: URLs sem segredos, mensagens mascaradas', () => {
    const [nav, busca, console_] = limparEvento(base()).breadcrumbs as Array<Record<string, unknown>>;
    expect(nav.data).toEqual({ from: '/a', to: 'https://app.vercel.app/' });
    expect(busca.data).toEqual({ url: 'https://api.exemplo.com/cadastro', method: 'POST', status_code: 202 });
    expect(console_.message).toBe('falha para [e-mail]');
  });

  it('descarta o campo extra', () => {
    expect(limparEvento(base())).not.toHaveProperty('extra');
  });

  it('não altera o objeto original', () => {
    const original = base();
    limparEvento(original);
    expect(original.request.headers.Authorization).toBe('Bearer x');
    expect(original.user.email).toBe('a@b.com');
  });
});

describe('limparEventoOuDescartar', () => {
  it('devolve o evento limpo', () => {
    expect(limparEventoOuDescartar({ message: 'x@y.com' })).toEqual({ message: '[e-mail]' });
  });

  it('na dúvida, descarta o evento em vez de enviá-lo sem limpar', () => {
    const quebrado = { get message(): string { throw new Error('boom'); } };
    expect(limparEventoOuDescartar(quebrado)).toBeNull();
  });
});
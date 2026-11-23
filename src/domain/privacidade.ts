type Obj = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// Ordem importa: token antes de chave=valor, e e-mail antes de números (a matrícula está dentro do e-mail).
const PADROES: [RegExp, string][] = [
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[token]'],
  [/\b(access_token|refresh_token|id_token|token|code|password|senha|apikey)=([^&\s"']+)/gi, '$1=[removido]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[e-mail]'],
  [/\b\d{6,15}\b/g, '[número]'],
];

export function mascarar(texto: string): string {
  return PADROES.reduce((t, [padrao, troca]) => t.replace(padrao, troca), texto);
}

/** Tira query e fragmento: links de convite e de recuperação carregam tokens ali. */
export function urlSemSegredos(url: string): string {
  return url.split('#')[0].split('?')[0];
}

const CHAVES_DE_URL = new Set(['url', 'from', 'to']);

function mascararValor(valor: unknown, profundidade = 0): unknown {
  if (typeof valor === 'string') return mascarar(valor);
  if (profundidade >= 4) return '[omitido]';
  if (Array.isArray(valor)) return valor.map((v) => mascararValor(v, profundidade + 1));
  if (ehObjeto(valor)) {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [
        k,
        typeof v === 'string' && CHAVES_DE_URL.has(k) ? mascarar(urlSemSegredos(v)) : mascararValor(v, profundidade + 1),
      ]),
    );
  }
  return valor;
}

const REMOVER_DA_REQUISICAO = new Set(['headers', 'cookies', 'data', 'query_string', 'env']);

function limparRequisicao(req: unknown): Obj | undefined {
  if (!ehObjeto(req)) return undefined;
  const resto = Object.fromEntries(Object.entries(req).filter(([k]) => !REMOVER_DA_REQUISICAO.has(k)));
  return typeof resto.url === 'string' ? { ...resto, url: mascarar(urlSemSegredos(resto.url)) } : resto;
}

/** Remove dados pessoais de um evento de erro ANTES de ele sair daqui. Não altera o original. */
export function limparEvento<T extends object>(evento: T): T {
  const e = evento as Obj;
  const saida: Obj = { ...e };
  delete saida.extra;
  delete saida.user;
  delete saida.request;

  if (ehObjeto(e.user) && typeof e.user.id === 'string' && e.user.id !== '') saida.user = { id: e.user.id };
  const requisicao = limparRequisicao(e.request);
  if (requisicao) saida.request = requisicao;

  if (typeof e.message === 'string') saida.message = mascarar(e.message);
  if (typeof e.transaction === 'string') saida.transaction = mascarar(urlSemSegredos(e.transaction));

  if (ehObjeto(e.exception) && Array.isArray(e.exception.values)) {
    saida.exception = {
      ...e.exception,
      values: e.exception.values.map((v) =>
        ehObjeto(v) && typeof v.value === 'string' ? { ...v, value: mascarar(v.value) } : v,
      ),
    };
  }
  if (Array.isArray(e.breadcrumbs)) {
    saida.breadcrumbs = e.breadcrumbs.map((b) => (ehObjeto(b) ? mascararValor(b) : b));
  }
  return saida as T;
}

/** Fail-closed: se a limpeza falhar por qualquer motivo, o evento é descartado, nunca enviado sujo. */
export function limparEventoOuDescartar<T extends object>(evento: T): T | null {
  try {
    return limparEvento(evento);
  } catch {
    return null;
  }
}
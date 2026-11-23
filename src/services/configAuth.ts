import { config } from '../config';

const TTL_MS = 10 * 60_000;
let cache: { seguro: boolean; expira: number } | null = null;

export function limparCacheConfigAuth(): void {
  cache = null;
}

/**
 * O cadastro só é seguro com o cadastro público FECHADO (disable_signup = true): aberto, qualquer pessoa
 * chama signUp direto e pode pré-criar a conta de outro aluno. Só devolve false quando o Supabase diz
 * explicitamente que está aberto; na dúvida devolve true e avisa no log.
 */
export async function cadastroPublicoFechado(
  fetchImpl: typeof fetch = fetch,
  agora: number = Date.now(),
): Promise<boolean> {
  if (cache && cache.expira > agora) return cache.seguro;
  try {
    const res = await fetchImpl(`${config.SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: config.SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`Configuração do Auth ilegível (HTTP ${res.status}); guarda desativada nesta chamada.`);
      return true;
    }
    const dados = (await res.json()) as { disable_signup?: unknown };
    if (typeof dados.disable_signup !== 'boolean') {
      console.warn('Campo disable_signup ausente na configuração do Auth; guarda desativada.');
      return true;
    }
    cache = { seguro: dados.disable_signup, expira: agora + TTL_MS };
    if (!dados.disable_signup) {
      console.error('ATENÇÃO: o cadastro público está ABERTO no Supabase. Novos cadastros foram bloqueados.');
    }
    return dados.disable_signup;
  } catch (e) {
    console.warn('Falha ao consultar a configuração do Auth; guarda desativada nesta chamada.', e);
    return true;
  }
}
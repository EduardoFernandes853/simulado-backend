import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env as Record<string, string>;
let falhas = 0;

type Res = { error: { code?: string; message: string } | null; data: unknown[] | unknown | null };

const detalhe = (r: Res) =>
  r.error ? `${r.error.code ?? ''} ${r.error.message}` : `${Array.isArray(r.data) ? r.data.length : 1} linha(s)`;

function checar(descricao: string, ok: boolean, r?: Res) {
  console.log(`${ok ? '✅ PASSOU' : '❌ FALHOU'} — ${descricao}${r ? `  [${detalhe(r)}]` : ''}`);
  if (!ok) falhas++;
}

const novoCliente = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function entrar(email: string, senha: string): Promise<SupabaseClient> {
  const c = novoCliente();
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(`Login falhou para ${email}: ${error.message}`);
  return c;
}

const vazio = (r: { data: unknown[] | null }) => (r.data?.length ?? 0) === 0;

async function main() {
  const anon = novoCliente();
  const a = await entrar(process.env.TESTE_A_EMAIL!, process.env.TESTE_A_SENHA!);
  const b = await entrar(process.env.TESTE_B_EMAIL!, process.env.TESTE_B_SENHA!);

  const cadA = await a.from('alunos').select('id');
  checar('Aluno A enxerga somente o próprio cadastro', cadA.data?.length === 1, cadA);
  const cadB = await b.from('alunos').select('id');
  checar('Aluno B enxerga somente o próprio cadastro', cadB.data?.length === 1, cadB);

  const tentA = await a.from('tentativas').select('id, aluno_id, nota');
  checar('Aluno A enxerga suas tentativas', (tentA.data?.length ?? 0) > 0, tentA);
  const idA = cadA.data?.[0]?.id;
  checar('Todas as tentativas vistas por A são de A', (tentA.data ?? []).every((t) => t.aluno_id === idA));

  const respA = await a.from('respostas').select('tentativa_id');
  checar('Aluno A enxerga as próprias respostas', (respA.data?.length ?? 0) > 0, respA);

  const alvo = (tentA.data ?? []).find((t) => t.nota !== null);
  if (!alvo || !respA.data?.length) {
    console.log('\n⚠️  A não tem tentativa finalizada visível. Os testes negativos abaixo seriam vazios e não provariam nada.');
    console.log('    Confira grants/RLS e finalize um simulado com A e com B. Rode de novo depois.');
    process.exit(1);
  }

  const espia = await b.from('tentativas').select('*').eq('id', alvo.id);
  checar('Aluno B NÃO lê a tentativa do aluno A', vazio(espia), espia);

  const todasB = await b.from('tentativas').select('aluno_id');
  checar('Nenhuma tentativa listada para B pertence a A', (todasB.data ?? []).every((t) => t.aluno_id !== idA));

  const respEspia = await b.from('respostas').select('*').eq('tentativa_id', respA.data[0].tentativa_id);
  checar('Aluno B NÃO lê as respostas do aluno A', vazio(respEspia), respEspia);

  const notaAntes = Number(alvo.nota);
  await a.from('tentativas').update({ nota: notaAntes === 100 ? 99 : 100 }).eq('id', alvo.id);
  const depois = await a.from('tentativas').select('nota').eq('id', alvo.id).single();
  checar('Aluno NÃO consegue alterar a própria nota pela API', Number(depois.data?.nota) === notaAntes, depois);

  const gab = await a.from('gabaritos').select('*');
  checar('Aluno NÃO lê o gabarito', vazio(gab), gab);
  const quest = await a.from('questoes').select('*');
  checar('Aluno NÃO lê o banco de questões fora de uma tentativa', vazio(quest), quest);

  const visitante = await anon.from('alunos').select('*');
  checar('Visitante sem login NÃO lê alunos', vazio(visitante), visitante);

  console.log(falhas === 0 ? '\nRLS validada.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
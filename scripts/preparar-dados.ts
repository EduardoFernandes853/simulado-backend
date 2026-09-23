import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../src/prisma';

const { SUPABASE_URL, SUPABASE_ANON_KEY, TESTE_A_EMAIL, TESTE_A_SENHA, TESTE_B_EMAIL, TESTE_B_SENHA } = process.env;

async function main() {
  console.log("Iniciando injeção de dados via Prisma...");
  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: false }});

  // 1. Faz login para pegar o ID real gerado pelo Supabase
  const { data: authA, error: errA } = await supabase.auth.signInWithPassword({ email: TESTE_A_EMAIL!, password: TESTE_A_SENHA! });
  const { data: authB, error: errB } = await supabase.auth.signInWithPassword({ email: TESTE_B_EMAIL!, password: TESTE_B_SENHA! });

  if (errA || errB) {
    console.error("❌ Falha no login. O Supabase não reconheceu o e-mail ou senha.");
    process.exit(1);
  }

  // 2. Limpa os dados velhos/quebrados que tentámos inserir por SQL
  await prisma.aluno.deleteMany({ where: { email: { in: [TESTE_A_EMAIL!, TESTE_B_EMAIL!] } } });

  // 3. Cria os alunos perfeitamente vinculados ao ID de autenticação
  const alunoA = await prisma.aluno.create({
    data: { authId: authA.user.id, matricula: 'A001', nome: 'Aluno Teste A', email: TESTE_A_EMAIL! }
  });
  const alunoB = await prisma.aluno.create({
    data: { authId: authB.user.id, matricula: 'B002', nome: 'Aluno Teste B', email: TESTE_B_EMAIL! }
  });

  // 4. Pega a prova e uma questão
  const simulado = await prisma.simulado.findFirst();
  const questao = await prisma.questao.findFirst();

  // 5. Cria a tentativa do Aluno A (com 1 resposta)
  await prisma.tentativa.create({
    data: {
      alunoId: alunoA.id, simuladoId: simulado!.id, status: 'FINALIZADA', nota: 80,
      prazoEm: new Date(), finalizadaEm: new Date(),
      respostas: { create: { questaoId: questao!.id, alternativa: 'A', correta: true } }
    }
  });

  // 6. Cria a tentativa do Aluno B
  await prisma.tentativa.create({
    data: {
      alunoId: alunoB.id, simuladoId: simulado!.id, status: 'FINALIZADA', nota: 60,
      prazoEm: new Date(), finalizadaEm: new Date()
    }
  });

  console.log("✅ Dados perfeitos criados no banco! Pode rodar o teste RLS agora.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export const TABELAS_DE_APLICACAO = [
  'alertas_monitoria',
  'auditoria',
  'respostas',
  'tentativas',
  'simulado_questoes',
  'simulados',
  'gabaritos',
  'alternativas',
  'questoes',
  'topicos',
  'disciplinas',
  'alunos',
] as const;

/** Defesa em profundidade: mesmo com a trava da URL, confere o banco REAL conectado antes de apagar. */
export async function limparBanco(): Promise<void> {
  const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  if (!/test/i.test(db)) throw new Error(`Recusando limpar o banco "${db}": não parece ser de teste.`);
  const lista = TABELAS_DE_APLICACAO.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

export const desconectar = () => prisma.$disconnect();

export const como = (a: { id: string }) => ({ 'x-aluno-id': a.id });

let contador = 0;
const proximo = () => ++contador;

export async function criarAluno(extra: Partial<Prisma.AlunoUncheckedCreateInput> = {}) {
  const n = String(proximo()).padStart(8, '0');
  return prisma.aluno.create({
    data: {
      matricula: `2026${n}`,
      nome: `Aluno ${n}`,
      email: `2026${n}@aluno.ifpa.edu.br`,
      ...extra,
    },
  });
}

export const criarProfessor = (extra: Partial<Prisma.AlunoUncheckedCreateInput> = {}) =>
  criarAluno({ papel: 'PROFESSOR', ...extra });

export async function criarTopico(disciplina = 'Redes', topico = 'Transporte') {
  const d = await prisma.disciplina.upsert({
    where: { nome: disciplina },
    update: {},
    create: { nome: disciplina },
  });
  return prisma.topico.upsert({
    where: { disciplinaId_nome: { disciplinaId: d.id, nome: topico } },
    update: {},
    create: { disciplinaId: d.id, nome: topico },
  });
}

export async function criarQuestao(topicoId: string, correta = 'A') {
  const n = proximo();
  return prisma.questao.create({
    data: {
      enunciado: `Enunciado da questão ${n}`,
      topicoId,
      alternativas: {
        create: ['A', 'B', 'C', 'D'].map((letra) => ({ letra, texto: `Alternativa ${letra}` })),
      },
      gabarito: {
        create: { alternativaCorreta: correta, justificativa: `A ${correta} é a correta.` },
      },
    },
  });
}

export async function criarSimuladoCompleto(totalQuestoes = 3) {
  const topico = await criarTopico();
  const questoes = [];
  for (let i = 0; i < totalQuestoes; i++) questoes.push(await criarQuestao(topico.id));
  const simulado = await prisma.simulado.create({
    data: {
      titulo: 'Simulado de teste',
      duracaoMin: 30,
      publicado: true,
      status: 'PUBLICADO',
      questoes: {
        create: questoes.map((q, i) => ({ questaoId: q.id, ordem: i + 1 })),
      },
    },
  });
  return { simulado, questoes };
}
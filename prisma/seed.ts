import { PrismaClient } from '@prisma/client';
import type { Dificuldade } from '@prisma/client';

const prisma = new PrismaClient();
const LETRAS = ['A', 'B', 'C', 'D', 'E'];

interface QuestaoSeed {
  disciplina: string;
  topico: string;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: string[];
  correta: string;
}

const QUESTOES: QuestaoSeed[] = [
  { disciplina: 'Programação', topico: 'Orientação a Objetos', dificuldade: 'MEDIA', enunciado: 'Qual princípio da Orientação a Objetos oculta os detalhes internos de uma classe e expõe apenas uma interface?', alternativas: ['Herança', 'Encapsulamento', 'Polimorfismo', 'Sobrecarga'], correta: 'Encapsulamento' },
  { disciplina: 'Programação', topico: 'Estruturas de Dados', dificuldade: 'FACIL', enunciado: 'Qual estrutura de dados segue a política LIFO (último a entrar, primeiro a sair)?', alternativas: ['Pilha', 'Fila', 'Lista ligada', 'Árvore binária'], correta: 'Pilha' },
  { disciplina: 'Programação', topico: 'Complexidade', dificuldade: 'MEDIA', enunciado: 'Qual é a complexidade de tempo, no pior caso, da busca binária em um vetor ordenado com n elementos?', alternativas: ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'], correta: 'O(log n)' },
  { disciplina: 'Banco de Dados', topico: 'SQL', dificuldade: 'FACIL', enunciado: 'Qual comando SQL remove linhas de uma tabela com base em uma condição?', alternativas: ['DROP', 'TRUNCATE', 'REMOVE', 'DELETE'], correta: 'DELETE' },
  { disciplina: 'Banco de Dados', topico: 'Modelagem Relacional', dificuldade: 'FACIL', enunciado: 'Qual restrição identifica de forma única cada registro de uma tabela relacional?', alternativas: ['Chave primária', 'Chave estrangeira', 'Índice secundário', 'Visão'], correta: 'Chave primária' },
  { disciplina: 'Matemática', topico: 'Álgebra', dificuldade: 'FACIL', enunciado: 'Qual é o valor de x na equação 2x + 10 = 20?', alternativas: ['3', '5', '6', '8'], correta: '5' },
  { disciplina: 'Matemática', topico: 'Probabilidade', dificuldade: 'FACIL', enunciado: 'Ao lançar um dado justo de seis faces, qual é a probabilidade de obter um número par?', alternativas: ['1/6', '1/3', '2/3', '1/2'], correta: '1/2' },
  { disciplina: 'Física', topico: 'Mecânica', dificuldade: 'FACIL', enunciado: 'Qual é a unidade de força no Sistema Internacional de Unidades?', alternativas: ['Joule', 'Watt', 'Newton', 'Pascal'], correta: 'Newton' },
  { disciplina: 'Física', topico: 'Eletricidade', dificuldade: 'MEDIA', enunciado: 'De acordo com a Lei de Ohm, qual é a relação entre tensão (V), corrente (I) e resistência (R)?', alternativas: ['V = R / I', 'V = R · I', 'V = R + I', 'V = I / R'], correta: 'V = R · I' },
  { disciplina: 'Redes', topico: 'Camada de Transporte', dificuldade: 'MEDIA', enunciado: 'Qual protocolo da camada de transporte oferece entrega confiável e orientada a conexão?', alternativas: ['TCP', 'UDP', 'IP', 'ICMP'], correta: 'TCP' },
];

async function main() {
  const ids: string[] = [];
  for (const q of QUESTOES) {
    const idx = q.alternativas.indexOf(q.correta);
    if (idx === -1) throw new Error(`Correta fora das alternativas: ${q.enunciado}`);
    const disciplina = await prisma.disciplina.upsert({
      where: { nome: q.disciplina }, update: {}, create: { nome: q.disciplina },
    });
    const topico = await prisma.topico.upsert({
      where: { disciplinaId_nome: { disciplinaId: disciplina.id, nome: q.topico } },
      update: {},
      create: { disciplinaId: disciplina.id, nome: q.topico },
    });
    let questao = await prisma.questao.findFirst({ where: { enunciado: q.enunciado } });
    if (!questao) {
      questao = await prisma.questao.create({
        data: {
          enunciado: q.enunciado,
          dificuldade: q.dificuldade,
          topicoId: topico.id,
          alternativas: { create: q.alternativas.map((texto, i) => ({ letra: LETRAS[i], texto })) },
          gabarito: { create: { alternativaCorreta: LETRAS[idx] } },
        },
      });
    }
    ids.push(questao.id);
  }
  const titulo = 'Simulado Diagnóstico – Setembro/2026';
  const simulado =
    (await prisma.simulado.findFirst({ where: { titulo } })) ??
    (await prisma.simulado.create({
      data: { titulo, descricao: 'Diagnóstico inicial por disciplina.', duracaoMin: 30, publicado: true },
    }));
  for (const [i, questaoId] of ids.entries()) {
    await prisma.simuladoQuestao.upsert({
      where: { simuladoId_questaoId: { simuladoId: simulado.id, questaoId } },
      update: {},
      create: { simuladoId: simulado.id, questaoId, ordem: i + 1 },
    });
  }
  console.log(`Seed ok: ${ids.length} questões no simulado "${titulo}".`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
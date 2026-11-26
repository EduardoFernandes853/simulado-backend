import { prisma } from '../prisma';
import {
  TABELAS_DE_APLICACAO,
  criarAluno,
  criarQuestao,
  criarSimuladoCompleto,
  desconectar,
  limparBanco,
} from './ajudas';

beforeEach(limparBanco);
afterAll(desconectar);

describe('o banco criado pelas migrações', () => {
  it('aplicou todas as migrações, nenhuma pela metade', async () => {
    const [{ total, pendentes }] = await prisma.$queryRaw<{ total: bigint; pendentes: bigint }[]>`
      SELECT count(*) AS total, count(*) FILTER (WHERE finished_at IS NULL) AS pendentes FROM _prisma_migrations`;
    expect(Number(total)).toBeGreaterThan(0);
    expect(Number(pendentes)).toBe(0);
  });

  it('limparBanco cobre todas as tabelas do schema (senão dados vazam entre testes)', async () => {
    const tabelas = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
    expect(tabelas.map((t) => t.table_name).sort()).toEqual([...TABELAS_DE_APLICACAO].sort());
  });
});

describe('restrições de integridade', () => {
  it('nota fora de 0–100 é recusada pelo banco (CHECK da migração)', async () => {
    const aluno = await criarAluno();
    const { simulado } = await criarSimuladoCompleto(1);
    await expect(
      prisma.tentativa.create({ data: { alunoId: aluno.id, simuladoId: simulado.id, prazoEm: new Date(), nota: 101 } }),
    ).rejects.toThrow(/tentativas_nota_chk|check constraint/i);
  });

  it('letra de alternativa fora de A–E é recusada pelo banco', async () => {
    const { questoes } = await criarSimuladoCompleto(1);
    await expect(
      prisma.alternativa.create({ data: { questaoId: questoes[0].id, letra: 'Z', texto: 'x' } }),
    ).rejects.toThrow(/alternativas_letra_chk|check constraint/i);
  });

  it('matrícula é única', async () => {
    const a = await criarAluno();
    await expect(criarAluno({ matricula: a.matricula })).rejects.toMatchObject({ code: 'P2002' });
  });

  it('duas questões não ocupam a mesma posição no simulado', async () => {
    const { simulado, questoes } = await criarSimuladoCompleto(1);
    const outra = await criarQuestao(questoes[0].topicoId);
    await expect(
      prisma.simuladoQuestao.create({ data: { simuladoId: simulado.id, questaoId: outra.id, ordem: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('questão que está em um simulado não pode ser excluída (Restrict)', async () => {
    const { questoes } = await criarSimuladoCompleto(1);
    await expect(prisma.questao.delete({ where: { id: questoes[0].id } })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('excluir o aluno apaga tentativas, respostas e alertas, e não toca no banco de questões', async () => {
    const aluno = await criarAluno();
    const { simulado, questoes } = await criarSimuladoCompleto(1);
    const t = await prisma.tentativa.create({
      data: { alunoId: aluno.id, simuladoId: simulado.id, prazoEm: new Date(), status: 'FINALIZADA', nota: 0 },
    });
    await prisma.resposta.create({
      data: { tentativaId: t.id, questaoId: questoes[0].id, alternativa: 'B', correta: false },
    });
    await prisma.alertaMonitoria.create({
      data: { tentativaId: t.id, alunoId: aluno.id, nota: 0, limiar: 60 },
    });

    await prisma.aluno.delete({ where: { id: aluno.id } });

    expect(await prisma.tentativa.count()).toBe(0);
    expect(await prisma.resposta.count()).toBe(0);
    expect(await prisma.alertaMonitoria.count()).toBe(0);
    expect(await prisma.questao.count()).toBe(1);
  });
});
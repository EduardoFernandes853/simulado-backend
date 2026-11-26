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

describe('o que a migração "expandir" criou', () => {
  it('questão nova nasce ATIVA, versão 1, e atualizadoEm acompanha a edição', async () => {
    const { questoes } = await criarSimuladoCompleto(1);
    const antes = await prisma.questao.findUniqueOrThrow({ where: { id: questoes[0].id } });
    expect(antes).toMatchObject({ status: 'ATIVA', versao: 1 });
    await new Promise((r) => setTimeout(r, 15));
    const depois = await prisma.questao.update({ where: { id: antes.id }, data: { enunciado: 'Novo enunciado' } });
    expect(depois.atualizadoEm.getTime()).toBeGreaterThan(antes.atualizadoEm.getTime());
  });

  it('simulado novo nasce em RASCUNHO e com revisão IMEDIATA', async () => {
    const s = await prisma.simulado.create({ data: { titulo: 'Novo' } });
    expect(s).toMatchObject({ status: 'RASCUNHO', revisao: 'IMEDIATA', abreEm: null, fechaEm: null, maxTentativas: null });
  });

  it('o banco recusa janela invertida e limite de tentativas absurdo', async () => {
    await expect(
      prisma.simulado.create({ data: { titulo: 'x', abreEm: new Date('2026-12-02'), fechaEm: new Date('2026-12-01') } }),
    ).rejects.toThrow(/simulados_janela_chk|check constraint/i);
    await expect(prisma.simulado.create({ data: { titulo: 'x', maxTentativas: 0 } })).rejects.toThrow(
      /simulados_max_tent_chk|check constraint/i,
    );
    await expect(prisma.simulado.create({ data: { titulo: 'x', maxTentativas: 21 } })).rejects.toThrow(
      /simulados_max_tent_chk|check constraint/i,
    );
  });

  it('disciplina e tópico são únicos sem diferenciar maiúsculas, mas o mesmo tópico pode existir em outra disciplina', async () => {
    const d = await prisma.disciplina.create({ data: { nome: 'Redes' } });
    await expect(prisma.disciplina.create({ data: { nome: 'redes' } })).rejects.toMatchObject({ code: 'P2002' });
    await prisma.topico.create({ data: { nome: 'Camadas', disciplinaId: d.id } });
    await expect(prisma.topico.create({ data: { nome: 'CAMADAS', disciplinaId: d.id } })).rejects.toMatchObject({ code: 'P2002' });
    const outra = await prisma.disciplina.create({ data: { nome: 'Sistemas Operacionais' } });
    await expect(prisma.topico.create({ data: { nome: 'Camadas', disciplinaId: outra.id } })).resolves.toBeDefined();
  });

  it('a auditoria guarda o detalhe em JSON e se consulta por entidade', async () => {
    const entidadeId = '11111111-1111-4111-8111-111111111111';
    await prisma.auditoria.create({
      data: {
        atorId: entidadeId,
        acao: 'QUESTAO_EDITADA',
        entidade: 'questao',
        entidadeId,
        detalhe: { antes: { correta: 'A' }, depois: { correta: 'B' } },
      },
    });
    const achada = await prisma.auditoria.findFirstOrThrow({ where: { entidade: 'questao', entidadeId } });
    expect(achada.detalhe).toEqual({ antes: { correta: 'A' }, depois: { correta: 'B' } });
  });
});
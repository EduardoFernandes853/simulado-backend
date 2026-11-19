import request from 'supertest';
import { criarApp } from '../app';
import { prisma } from '../prisma';
import { RevisaoSchema } from '../contracts';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.aluno = { id: 'aluno-1', papel: 'ALUNO' };
    next();
  },
  exigirProfessor: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../prisma', () => {
  const tx = {
    tentativa: { updateMany: jest.fn() },
    resposta: { createMany: jest.fn() },
    alertaMonitoria: { create: jest.fn() },
  };
  return {
    prisma: {
      tentativa: { findFirst: jest.fn(), update: jest.fn() },
      simuladoQuestao: { findMany: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
      __tx: tx,
    },
  };
});

const db = prisma as unknown as {
  tentativa: { findFirst: jest.Mock; update: jest.Mock };
  simuladoQuestao: { findMany: jest.Mock };
  __tx: {
    tentativa: { updateMany: jest.Mock };
    resposta: { createMany: jest.Mock };
    alertaMonitoria: { create: jest.Mock };
  };
};

const T = '11111111-1111-4111-8111-111111111111';
const Q1 = '22222222-2222-4222-8222-222222222222';
const Q2 = '33333333-3333-4333-8333-333333333333';

const item = (questaoId: string, correta: string, topico: string) => ({
  questaoId,
  questao: {
    gabarito: { alternativaCorreta: correta },
    topico: { nome: topico, disciplina: { nome: 'Programação' } },
  },
});

const tentativaAberta = (extra = {}) => ({
  id: T, alunoId: 'aluno-1', simuladoId: 'sim-1', status: 'EM_ANDAMENTO',
  prazoEm: new Date(Date.now() + 60_000), ...extra,
});

describe('POST /tentativas/:id/finalizar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.simuladoQuestao.findMany.mockResolvedValue([item(Q1, 'A', 'POO'), item(Q2, 'C', 'Álgebra')]);
    db.__tx.tentativa.updateMany.mockResolvedValue({ count: 1 });
  });

  it('calcula a nota no servidor e cria alerta quando < 60', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaAberta());
    const res = await request(criarApp())
      .post(`/tentativas/${T}/finalizar`)
      .send({ respostas: [{ questaoId: Q1, alternativa: 'A' }, { questaoId: Q2, alternativa: 'B' }], nota: 100 });
    
    expect(res.status).toBe(200);
    expect(res.body.nota).toBe(50);
    expect(res.body.alertaMonitoria).toBe(true);
    expect(db.__tx.alertaMonitoria.create).toHaveBeenCalledTimes(1);
  });

  it('não cria alerta quando a nota é >= 60', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaAberta());
    const res = await request(criarApp())
      .post(`/tentativas/${T}/finalizar`)
      .send({ respostas: [{ questaoId: Q1, alternativa: 'A' }, { questaoId: Q2, alternativa: 'C' }] });
    
    expect(res.status).toBe(200);
    expect(res.body.nota).toBe(100);
    expect(res.body.alertaMonitoria).toBe(false);
    expect(db.__tx.alertaMonitoria.create).not.toHaveBeenCalled();
  });

  it('404 quando a tentativa não pertence ao aluno', async () => {
    db.tentativa.findFirst.mockResolvedValue(null);
    const res = await request(criarApp()).post(`/tentativas/${T}/finalizar`).send({ respostas: [] });
    expect(res.status).toBe(404);
  });

  it('409 quando a tentativa já foi finalizada', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaAberta({ status: 'FINALIZADA' }));
    const res = await request(criarApp()).post(`/tentativas/${T}/finalizar`).send({ respostas: [] });
    expect(res.status).toBe(409);
  });

  it('409 e marca EXPIRADA quando o prazo passou', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaAberta({ prazoEm: new Date(Date.now() - 120_000) }));
    const res = await request(criarApp()).post(`/tentativas/${T}/finalizar`).send({ respostas: [] });
    
    expect(res.status).toBe(409);
    expect(db.tentativa.update).toHaveBeenCalledWith({
      where: { id: T },
      data: expect.objectContaining({ status: 'EXPIRADA' }),
    });
  });

  it('400 quando o corpo é inválido', async () => {
    const res = await request(criarApp())
      .post(`/tentativas/${T}/finalizar`)
      .send({ respostas: [{ questaoId: Q1, alternativa: 'Z' }] });
    expect(res.status).toBe(400);
  });
});

describe('GET /tentativas/:id/revisao', () => {
  beforeEach(() => jest.clearAllMocks());

  const tentativaFinalizada = {
    id: T,
    simuladoId: 'sim-1',
    nota: 50,
    simulado: { titulo: 'Diagnóstico' },
    respostas: [{ questaoId: Q1, alternativa: 'B' }], // Q2 fica em branco
  };

  const itemRevisao = (questaoId: string, correta: string | null) => ({
    questaoId,
    questao: {
      enunciado: `Enunciado ${questaoId}`,
      gabarito: correta ? { alternativaCorreta: correta, justificativa: 'Porque sim.' } : null,
      alternativas: [{ letra: 'A', texto: 'x' }, { letra: 'B', texto: 'y' }],
      topico: { nome: 'Transporte', disciplina: { nome: 'Redes' } },
    },
  });

  it('só libera tentativa FINALIZADA do próprio aluno, e não lê gabarito antes disso', async () => {
    db.tentativa.findFirst.mockResolvedValue(null);

    const res = await request(criarApp()).get(`/tentativas/${T}/revisao`);

    expect(res.status).toBe(404);
    expect(db.tentativa.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: T, alunoId: 'aluno-1', status: 'FINALIZADA' } }),
    );
    expect(db.simuladoQuestao.findMany).not.toHaveBeenCalled();
  });

  it('devolve acerto, erro e questão em branco, com os nomes do contrato', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaFinalizada);
    db.simuladoQuestao.findMany.mockResolvedValue([itemRevisao(Q1, 'A'), itemRevisao(Q2, 'B')]);

    const res = await request(criarApp()).get(`/tentativas/${T}/revisao`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tentativaId: T, simulado: 'Diagnóstico', nota: 50 });
    expect(res.body.questoes.map((q: { questaoId: string }) => q.questaoId)).toEqual([Q1, Q2]);
    expect(res.body.questoes[0]).toMatchObject({ escolhida: 'B', correta: 'A', acertou: false, justificativa: 'Porque sim.' });
    expect(res.body.questoes[1]).toMatchObject({ escolhida: null, correta: 'B', acertou: false });
    // o front valida a resposta com este schema: qualquer divergência de nome quebra a tela
    expect(RevisaoSchema.safeParse(res.body).error?.issues ?? []).toEqual([]);
  });

  it('500 quando uma questão está sem gabarito', async () => {
    db.tentativa.findFirst.mockResolvedValue(tentativaFinalizada);
    db.simuladoQuestao.findMany.mockResolvedValue([itemRevisao(Q1, null)]);

    const res = await request(criarApp()).get(`/tentativas/${T}/revisao`);

    expect(res.status).toBe(500);
    expect(res.body.erro).toBe('Questão sem gabarito.');
  });

  it('400 para id inválido', async () => {
    const res = await request(criarApp()).get('/tentativas/abc/revisao');
    expect(res.status).toBe(400);
  });
});
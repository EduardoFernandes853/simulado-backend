import request from 'supertest';
import { criarApp } from '../app';
import { prisma } from '../prisma';

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
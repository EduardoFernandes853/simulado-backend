import request from 'supertest';
import { criarApp } from '../app';
import { prisma } from '../prisma';
import { TOLERANCIA_MS } from '../domain/prazo';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.aluno = { id: 'aluno-1', papel: 'ALUNO' };
    next();
  },
  exigirProfessor: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../prisma', () => ({
  prisma: {
    simulado: { findFirst: jest.fn(), findMany: jest.fn() },
    tentativa: { updateMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  },
}));

const db = prisma as unknown as {
  simulado: { findFirst: jest.Mock; findMany: jest.Mock };
  tentativa: { updateMany: jest.Mock; findFirst: jest.Mock; create: jest.Mock };
};

const S = '44444444-4444-4444-8444-444444444444';
const MIN = 60_000;
const simulado = {
  id: S,
  titulo: 'Diagnóstico',
  duracaoMin: 30,
  questoes: [
    {
      ordem: 1,
      questao: {
        id: 'q1',
        enunciado: 'Qual protocolo é orientado a conexão?',
        topico: { nome: 'Transporte', disciplina: { nome: 'Redes' } },
        alternativas: [{ letra: 'A', texto: 'TCP' }, { letra: 'B', texto: 'UDP' }],
      },
    },
  ],
};

describe('POST /simulados/:id/tentativas', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.tentativa.updateMany.mockResolvedValue({ count: 0 });
  });

  it('cria a tentativa com prazo no servidor e sem expor gabarito (201)', async () => {
    db.simulado.findFirst.mockResolvedValue(simulado);
    db.tentativa.findFirst.mockResolvedValue(null);
    db.tentativa.create.mockImplementation(async ({ data }) => ({ id: 't1', ...data }));
    const res = await request(criarApp()).post(`/simulados/${S}/tentativas`);
    expect(res.status).toBe(201);
    expect(res.body.tentativaId).toBe('t1');
    expect(res.body.segundosRestantes).toBeGreaterThan(30 * 60 - 5);
    expect(res.body.segundosRestantes).toBeLessThanOrEqual(30 * 60);
    expect(JSON.stringify(res.body)).not.toMatch(/correta|gabarito/i);
  });

  it('retoma a tentativa em andamento sem criar outra (200)', async () => {
    db.simulado.findFirst.mockResolvedValue(simulado);
    db.tentativa.findFirst.mockResolvedValue({ id: 't-aberta', prazoEm: new Date(Date.now() + 10 * MIN) });
    const res = await request(criarApp()).post(`/simulados/${S}/tentativas`);
    expect(res.status).toBe(200);
    expect(res.body.tentativaId).toBe('t-aberta');
    expect(res.body.segundosRestantes).toBeGreaterThan(590);
    expect(res.body.segundosRestantes).toBeLessThanOrEqual(600);
    expect(db.tentativa.create).not.toHaveBeenCalled();
  });

  it('encerra as tentativas vencidas deste aluno neste simulado ANTES de decidir se retoma', async () => {
    db.simulado.findFirst.mockResolvedValue(simulado);
    db.tentativa.findFirst.mockResolvedValue(null);
    db.tentativa.create.mockResolvedValue({ id: 't2', prazoEm: new Date(Date.now() + MIN) });
    await request(criarApp()).post(`/simulados/${S}/tentativas`);
    const chamada = db.tentativa.updateMany.mock.calls[0][0];
    expect(chamada.where).toMatchObject({ alunoId: 'aluno-1', simuladoId: S, status: 'EM_ANDAMENTO' });
    expect(chamada.data).toMatchObject({ status: 'EXPIRADA' });
    const limite: Date = chamada.where.prazoEm.lt;
    expect(Math.abs(Date.now() - TOLERANCIA_MS - limite.getTime())).toBeLessThan(2000);
    expect(db.tentativa.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      db.tentativa.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('404 quando o simulado não existe ou não está publicado', async () => {
    db.simulado.findFirst.mockResolvedValue(null);
    const res = await request(criarApp()).post(`/simulados/${S}/tentativas`);
    expect(res.status).toBe(404);
    expect(db.simulado.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: S, publicado: true } }),
    );
    expect(db.tentativa.updateMany).not.toHaveBeenCalled();
    expect(db.tentativa.create).not.toHaveBeenCalled();
  });

  it('400 para id inválido', async () => {
    const res = await request(criarApp()).post('/simulados/abc/tentativas');
    expect(res.status).toBe(400);
  });
});

describe('GET /simulados', () => {
  it('lista só os publicados, com o total de questões', async () => {
    jest.resetAllMocks();
    db.simulado.findMany.mockResolvedValue([
      { id: S, titulo: 'Diagnóstico', descricao: null, duracaoMin: 30, _count: { questoes: 3 } },
    ]);
    const res = await request(criarApp()).get('/simulados');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: S, titulo: 'Diagnóstico', descricao: null, duracaoMin: 30, totalQuestoes: 3 }]);
    expect(db.simulado.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { publicado: true } }));
  });
});
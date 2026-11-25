import request from 'supertest';
import { z } from 'zod';
import type { ZodTypeAny } from 'zod';
import { Prisma } from '@prisma/client';
import { criarApp } from '../app';
import { prisma } from '../prisma';
import {
  AlunoSchema,
  HistoricoSchema,
  IniciarTentativaRespostaSchema,
  ListaAlertasSchema,
  ListaSimuladosSchema,
  ResultadoTentativaSchema,
} from '../contracts';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    // campos extras de propósito: o /me não pode devolver o objeto inteiro
    req.aluno = {
      id: '55555555-5555-4555-8555-555555555555',
      authId: '66666666-6666-4666-8666-666666666666',
      nome: 'Maria Souza',
      matricula: '20260001',
      email: 'maria@ifpa.edu.br',
      papel: 'ALUNO',
      criadoEm: new Date('2026-11-01T12:00:00.000Z'),
      avisoVersao: null,
    };
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
      simulado: { findFirst: jest.fn(), findMany: jest.fn() },
      tentativa: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      simuladoQuestao: { findMany: jest.fn() },
      alertaMonitoria: { findMany: jest.fn() },
      $transaction: jest.fn(),
      __tx: tx,
    },
  };
});

const db = prisma as unknown as {
  simulado: { findFirst: jest.Mock; findMany: jest.Mock };
  tentativa: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  simuladoQuestao: { findMany: jest.Mock };
  alertaMonitoria: { findMany: jest.Mock };
  $transaction: jest.Mock;
  __tx: {
    tentativa: { updateMany: jest.Mock };
    resposta: { createMany: jest.Mock };
    alertaMonitoria: { create: jest.Mock };
  };
};

const S = '44444444-4444-4444-8444-444444444444';
const T = '11111111-1111-4111-8111-111111111111';
const Q1 = '22222222-2222-4222-8222-222222222222';
const Q2 = '33333333-3333-4333-8333-333333333333';
const A1 = '77777777-7777-4777-8777-777777777777';

/**
 * Valida a resposta contra o schema que o front usa E exige que nada tenha sido descartado:
 * z.object() ignora campos extras sem avisar, então um vazamento (ex.: gabarito) passaria batido.
 */
function exigirContrato<S extends ZodTypeAny>(schema: S, corpo: unknown): z.infer<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) {
    throw new Error(`Resposta fora do contrato:\n${JSON.stringify(r.error.issues, null, 2)}`);
  }
  expect(r.data).toEqual(corpo);
  return r.data;
}

beforeEach(() => {
  jest.resetAllMocks();
  db.$transaction.mockImplementation((fn: (t: unknown) => unknown) => fn(db.__tx));
  db.__tx.tentativa.updateMany.mockResolvedValue({ count: 1 });
  db.__tx.alertaMonitoria.create.mockResolvedValue({ id: A1 });
  db.tentativa.updateMany.mockResolvedValue({ count: 0 });
});

describe('o próprio verificador de contrato', () => {
  it('reprova nomes divergentes e campos extras', () => {
    expect(() => exigirContrato(ListaSimuladosSchema, [{ id: S, nome: 'x' }])).toThrow(/fora do contrato/);
    const comExtra = [{ id: S, titulo: 'x', descricao: null, duracaoMin: 30, totalQuestoes: 1, correta: 'A' }];
    expect(() => exigirContrato(ListaSimuladosSchema, comExtra)).toThrow();
  });
});

describe('contrato: GET /me', () => {
  it('devolve só os campos públicos do aluno', async () => {
    const res = await request(criarApp()).get('/me');
    expect(res.status).toBe(200);
    expect(exigirContrato(AlunoSchema, res.body).papel).toBe('ALUNO');
  });
});

describe('contrato: GET /simulados', () => {
  it('lista com e sem descrição', async () => {
    db.simulado.findMany.mockResolvedValue([
      { id: S, titulo: 'Diagnóstico', descricao: 'Texto', duracaoMin: 30, _count: { questoes: 5 } },
      { id: T, titulo: 'Revisão', descricao: null, duracaoMin: 45, _count: { questoes: 10 } },
    ]);

    const res = await request(criarApp()).get('/simulados');

    expect(res.status).toBe(200);
    expect(exigirContrato(ListaSimuladosSchema, res.body)).toHaveLength(2);
  });

  it('lista vazia também cumpre o contrato', async () => {
    db.simulado.findMany.mockResolvedValue([]);
    const res = await request(criarApp()).get('/simulados');
    expect(exigirContrato(ListaSimuladosSchema, res.body)).toEqual([]);
  });
});

describe('contrato: POST /simulados/:id/tentativas', () => {
  const simulado = {
    id: S,
    titulo: 'Diagnóstico',
    duracaoMin: 30,
    questoes: [
      {
        ordem: 1,
        questao: {
          id: Q1,
          enunciado: 'Qual protocolo é orientado a conexão?',
          topico: { nome: 'Transporte', disciplina: { nome: 'Redes' } },
          alternativas: [{ letra: 'A', texto: 'TCP' }, { letra: 'B', texto: 'UDP' }],
        },
      },
      {
        ordem: 2,
        questao: {
          id: Q2,
          enunciado: 'Quanto é 2 + 2?',
          topico: { nome: 'Álgebra', disciplina: { nome: 'Matemática' } },
          alternativas: [{ letra: 'A', texto: '3' }, { letra: 'B', texto: '4' }],
        },
      },
    ],
  };

  it('tentativa nova (201) cumpre o contrato e não traz gabarito', async () => {
    db.simulado.findFirst.mockResolvedValue(simulado);
    db.tentativa.findFirst.mockResolvedValue(null);
    db.tentativa.create.mockImplementation(async ({ data }) => ({ id: T, ...data }));

    const res = await request(criarApp()).post(`/simulados/${S}/tentativas`);

    expect(res.status).toBe(201);
    const prova = exigirContrato(IniciarTentativaRespostaSchema, res.body);
    expect(prova.questoes).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/gabarito|correta/i);
  });

  it('tentativa retomada (200) cumpre o mesmo contrato', async () => {
    db.simulado.findFirst.mockResolvedValue(simulado);
    db.tentativa.findFirst.mockResolvedValue({ id: T, prazoEm: new Date(Date.now() + 10 * 60_000) });

    const res = await request(criarApp()).post(`/simulados/${S}/tentativas`);

    expect(res.status).toBe(200);
    exigirContrato(IniciarTentativaRespostaSchema, res.body);
  });
});

describe('contrato: POST /tentativas/:id/finalizar', () => {
  const item = (questaoId: string, correta: string, topico: string) => ({
    questaoId,
    questao: {
      gabarito: { alternativaCorreta: correta },
      topico: { nome: topico, disciplina: { nome: 'Redes' } },
    },
  });
  const tentativaAberta = () => ({
    id: T,
    simuladoId: S,
    status: 'EM_ANDAMENTO',
    prazoEm: new Date(Date.now() + 60_000),
  });

  beforeEach(() => {
    db.tentativa.findFirst.mockResolvedValue(tentativaAberta());
    db.simuladoQuestao.findMany.mockResolvedValue([item(Q1, 'A', 'Transporte'), item(Q2, 'C', 'Roteamento')]);
  });

  it('nota abaixo do limiar: contrato + alerta', async () => {
    const res = await request(criarApp())
      .post(`/tentativas/${T}/finalizar`)
      .send({ respostas: [{ questaoId: Q1, alternativa: 'B' }, { questaoId: Q2, alternativa: 'B' }] });

    expect(res.status).toBe(200);
    const r = exigirContrato(ResultadoTentativaSchema, res.body);
    expect(r.nota).toBe(0);
    expect(r.alertaMonitoria).toBe(true);
    expect(db.__tx.alertaMonitoria.create).toHaveBeenCalledTimes(1);
  });

  it('nota acima do limiar: contrato + sem alerta', async () => {
    const res = await request(criarApp())
      .post(`/tentativas/${T}/finalizar`)
      .send({ respostas: [{ questaoId: Q1, alternativa: 'A' }, { questaoId: Q2, alternativa: 'C' }] });

    expect(res.status).toBe(200);
    const r = exigirContrato(ResultadoTentativaSchema, res.body);
    expect(r.nota).toBe(100);
    expect(r.alertaMonitoria).toBe(false);
    expect(db.__tx.alertaMonitoria.create).not.toHaveBeenCalled();
  });
});

describe('contrato: GET /tentativas/minhas', () => {
  const data = new Date('2026-11-16T12:00:00.000Z');

  it('notas Decimal chegam como número, não como texto', async () => {
    db.tentativa.findMany.mockResolvedValue([
      { id: T, nota: new Prisma.Decimal('45.5'), finalizadaEm: data, simulado: { titulo: 'Diagnóstico' }, alerta: { id: A1 } },
      { id: S, nota: new Prisma.Decimal('80'), finalizadaEm: data, simulado: { titulo: 'Revisão' }, alerta: null },
    ]);

    const res = await request(criarApp()).get('/tentativas/minhas');

    expect(res.status).toBe(200);
    const lista = exigirContrato(HistoricoSchema, res.body);
    expect(lista[0]).toMatchObject({ nota: 45.5, alertaMonitoria: true });
    expect(lista[1]).toMatchObject({ nota: 80, alertaMonitoria: false });
    expect(db.tentativa.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'FINALIZADA' }) }),
    );
  });

  it('histórico vazio cumpre o contrato', async () => {
    db.tentativa.findMany.mockResolvedValue([]);
    const res = await request(criarApp()).get('/tentativas/minhas');
    expect(exigirContrato(HistoricoSchema, res.body)).toEqual([]);
  });
});

describe('contrato: GET /monitoria/alertas', () => {
  const alerta = {
    id: A1,
    nota: new Prisma.Decimal('40'),
    limiar: new Prisma.Decimal('60'),
    status: 'PENDENTE',
    criadoEm: new Date('2026-11-16T12:00:00.000Z'),
    aluno: { nome: 'Maria Souza', matricula: '20260001', email: 'maria@ifpa.edu.br' },
    tentativa: { simulado: { titulo: 'Diagnóstico' } },
  };

  it('cumpre o contrato e filtra PENDENTE por padrão', async () => {
    db.alertaMonitoria.findMany.mockResolvedValue([alerta]);

    const res = await request(criarApp()).get('/monitoria/alertas');

    expect(res.status).toBe(200);
    const lista = exigirContrato(ListaAlertasSchema, res.body);
    expect(lista[0]).toMatchObject({ nota: 40, limiar: 60, status: 'PENDENTE', simulado: 'Diagnóstico' });
    expect(db.alertaMonitoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDENTE' } }),
    );
  });

  it('aceita ?status=ATENDIDO e rejeita valor inválido com 400', async () => {
    db.alertaMonitoria.findMany.mockResolvedValue([]);

    const ok = await request(criarApp()).get('/monitoria/alertas?status=ATENDIDO');
    expect(ok.status).toBe(200);
    expect(db.alertaMonitoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ATENDIDO' } }),
    );

    const ruim = await request(criarApp()).get('/monitoria/alertas?status=QUALQUER');
    expect(ruim.status).toBe(400);
  });
});
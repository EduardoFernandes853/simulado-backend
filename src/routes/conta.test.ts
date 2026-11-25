import request from 'supertest';
import { Prisma } from '@prisma/client';
import { criarApp } from '../app';
import { AlunoSchema, DadosTitularSchema, VERSAO_AVISO } from '../contracts';
import { prisma } from '../prisma';
import { depsSupabase } from '../services/conviteSupabase';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.aluno = {
      id: '55555555-5555-4555-8555-555555555555',
      authId: '66666666-6666-4666-8666-666666666666',
      nome: 'Maria Souza',
      matricula: '20260001',
      email: '20260001@aluno.ifpa.edu.br',
      papel: req.headers['x-papel'] ?? 'ALUNO',
      criadoEm: new Date('2026-11-01T12:00:00.000Z'),
      avisoVersao: null,
      avisoAceitoEm: null,
    };
    next();
  },
  exigirProfessor: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../prisma', () => ({
  prisma: {
    aluno: { update: jest.fn(), delete: jest.fn() },
    tentativa: { findMany: jest.fn() },
    alertaMonitoria: { findMany: jest.fn() },
  },
}));

jest.mock('../services/conviteSupabase', () => ({
  depsSupabase: { removerUsuario: jest.fn() },
}));

const db = prisma as unknown as {
  aluno: { update: jest.Mock; delete: jest.Mock };
  tentativa: { findMany: jest.Mock };
  alertaMonitoria: { findMany: jest.Mock };
};
const removerLogin = depsSupabase.removerUsuario as jest.Mock;

const A = '55555555-5555-4555-8555-555555555555';
const AUTH = '66666666-6666-4666-8666-666666666666';
const T = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const AL = '88888888-8888-4888-8888-888888888888';

const registro = {
  id: A,
  nome: 'Maria da Silva',
  matricula: '20260001',
  email: '20260001@aluno.ifpa.edu.br',
  papel: 'ALUNO',
  avisoVersao: null,
};

beforeEach(() => jest.resetAllMocks());

describe('GET /me', () => {
  it('devolve o perfil, incluindo a versão do aviso já aceita', async () => {
    const res = await request(criarApp()).get('/me');
    expect(res.status).toBe(200);
    expect(AlunoSchema.parse(res.body)).toEqual(res.body);
    expect(res.body.avisoVersao).toBeNull();
  });
});

describe('PATCH /me', () => {
  it('atualiza só o nome, ignorando matrícula, papel e e-mail enviados', async () => {
    db.aluno.update.mockResolvedValue(registro);
    const res = await request(criarApp())
      .patch('/me')
      .send({ nome: '  Maria da Silva ', matricula: '999999', papel: 'PROFESSOR', email: 'x@y.com' });
    expect(res.status).toBe(200);
    expect(db.aluno.update).toHaveBeenCalledWith({ where: { id: A }, data: { nome: 'Maria da Silva' } });
    expect(res.body.nome).toBe('Maria da Silva');
  });

  it.each([[{ nome: 'ab' }], [{}], [{ nome: 'x'.repeat(121) }]])('400 para %p', async (corpo) => {
    const res = await request(criarApp()).patch('/me').send(corpo);
    expect(res.status).toBe(400);
    expect(db.aluno.update).not.toHaveBeenCalled();
  });
});

describe('POST /me/ciencia', () => {
  it('registra a versão atual do aviso, com a data', async () => {
    db.aluno.update.mockResolvedValue({ ...registro, avisoVersao: VERSAO_AVISO });
    const res = await request(criarApp()).post('/me/ciencia').send({ versao: VERSAO_AVISO });
    expect(res.status).toBe(200);
    expect(db.aluno.update).toHaveBeenCalledWith({
      where: { id: A },
      data: { avisoVersao: VERSAO_AVISO, avisoAceitoEm: expect.any(Date) },
    });
    expect(res.body.avisoVersao).toBe(VERSAO_AVISO);
  });

  it('409 para versão antiga ou inventada, sem gravar nada', async () => {
    const res = await request(criarApp()).post('/me/ciencia').send({ versao: 'v0' });
    expect(res.status).toBe(409);
    expect(db.aluno.update).not.toHaveBeenCalled();
  });

  it('400 sem versão', async () => {
    expect((await request(criarApp()).post('/me/ciencia').send({})).status).toBe(400);
  });
});

describe('GET /me/dados (direito de acesso)', () => {
  beforeEach(() => {
    db.tentativa.findMany.mockResolvedValue([
      {
        id: T,
        simulado: { titulo: 'Diagnóstico' },
        iniciadaEm: new Date('2026-11-02T10:00:00.000Z'),
        finalizadaEm: new Date('2026-11-02T10:20:00.000Z'),
        status: 'FINALIZADA',
        nota: new Prisma.Decimal('50'),
        respostas: [{ questaoId: Q, alternativa: 'A', correta: true, id: 'interno', tentativaId: T }],
      },
    ]);
    db.alertaMonitoria.findMany.mockResolvedValue([
      {
        id: AL,
        nota: new Prisma.Decimal('50'),
        limiar: new Prisma.Decimal('60'),
        status: 'PENDENTE',
        criadoEm: new Date('2026-11-02T10:21:00.000Z'),
        atendidoEm: null,
        atendidoPorId: null,
      },
    ]);
  });

  it('cumpre o contrato, sem campos internos, com notas como número', async () => {
    const res = await request(criarApp()).get('/me/dados');
    expect(res.status).toBe(200);
    const dados = DadosTitularSchema.parse(res.body);
    expect(dados).toEqual(res.body);
    expect(dados.tentativas[0].nota).toBe(50);
    expect(dados.titular.matricula).toBe('20260001');
  });

  it('só traz dados do próprio aluno e nunca o authId nem gabarito', async () => {
    const res = await request(criarApp()).get('/me/dados');
    expect(db.tentativa.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { alunoId: A } }));
    expect(db.alertaMonitoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { alunoId: A } }));
    expect(JSON.stringify(res.body)).not.toContain(AUTH);
    expect(JSON.stringify(res.body)).not.toMatch(/gabarito/i);
  });
});

describe('DELETE /me (direito de eliminação)', () => {
  it('400 sem a confirmação, sem apagar nada', async () => {
    const res = await request(criarApp()).delete('/me').send({});
    expect(res.status).toBe(400);
    expect(db.aluno.delete).not.toHaveBeenCalled();
    expect(removerLogin).not.toHaveBeenCalled();
  });

  it('403 para professor, sem apagar nada', async () => {
    const res = await request(criarApp()).delete('/me').set('x-papel', 'PROFESSOR').send({ confirmacao: 'EXCLUIR' });
    expect(res.status).toBe(403);
    expect(db.aluno.delete).not.toHaveBeenCalled();
  });

  it('apaga os dados e depois o login, nessa ordem (204)', async () => {
    db.aluno.delete.mockResolvedValue({});
    removerLogin.mockResolvedValue(undefined);
    const res = await request(criarApp()).delete('/me').send({ confirmacao: 'EXCLUIR' });
    expect(res.status).toBe(204);
    expect(db.aluno.delete).toHaveBeenCalledWith({ where: { id: A } });
    expect(removerLogin).toHaveBeenCalledWith(AUTH);
    expect(db.aluno.delete.mock.invocationCallOrder[0]).toBeLessThan(removerLogin.mock.invocationCallOrder[0]);
  });

  it('se o login não puder ser removido, diz que os dados já foram apagados (502)', async () => {
    db.aluno.delete.mockResolvedValue({});
    removerLogin.mockRejectedValue(new Error('supabase fora'));
    const silenciar = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(criarApp()).delete('/me').send({ confirmacao: 'EXCLUIR' });
    expect(res.status).toBe(502);
    expect(res.body.erro).toMatch(/dados foram apagados/i);
    silenciar.mockRestore();
  });
});

describe('limite das operações sensíveis', () => {
  it('429 na segunda exportação em um minuto quando o limite é 1', async () => {
    db.tentativa.findMany.mockResolvedValue([]);
    db.alertaMonitoria.findMany.mockResolvedValue([]);
    const app = criarApp({ limiteSensivelPorMin: 1 });
    await request(app).get('/me/dados').expect(200);
    await request(app).get('/me/dados').expect(429);
  });
});
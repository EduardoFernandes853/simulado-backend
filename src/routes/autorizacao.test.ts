import request from 'supertest';
import * as auth from '../middleware/auth';
import { criarApp } from '../app';
import { prisma } from '../prisma';

// Só o requireAuth é simulado (papel vem do cabeçalho x-papel). O exigirProfessor é o REAL.
jest.mock('../middleware/auth', () => {
  const real = jest.requireActual('../middleware/auth');
  return {
    ...real,
    requireAuth: (req: any, _res: any, next: any) => {
      if (req.headers['x-sem-aluno'] === undefined) {
        req.aluno = { id: '55555555-5555-4555-8555-555555555555', papel: req.headers['x-papel'] };
      }
      next();
    },
  };
});

jest.mock('../prisma', () => ({
  prisma: { alertaMonitoria: { findMany: jest.fn(), update: jest.fn() } },
}));

const db = prisma as unknown as { alertaMonitoria: { findMany: jest.Mock; update: jest.Mock } };

const ALERTA = '88888888-8888-4888-8888-888888888888';

type Metodo = 'get' | 'patch';

// Toda rota exclusiva de professor entra aqui. Ao criar uma nova, acrescente uma linha.
const ROTAS_DE_PROFESSOR: [string, Metodo, string][] = [
  ['listar alertas', 'get', '/monitoria/alertas'],
  ['atender alerta', 'patch', `/monitoria/alertas/${ALERTA}/atender`],
];

// Só o texto exato 'PROFESSOR' libera. Variações de caixa e papéis desconhecidos são negados.
const PAPEIS_SEM_ACESSO = ['ALUNO', 'professor', 'Professor', 'ADMIN'];

beforeEach(() => jest.resetAllMocks());

it('usa o exigirProfessor REAL (o mock só substitui o requireAuth)', () => {
  expect(auth.exigirProfessor).toBe(jest.requireActual('../middleware/auth').exigirProfessor);
});

describe.each(ROTAS_DE_PROFESSOR)('%s', (_nome, metodo, url) => {
  it.each(PAPEIS_SEM_ACESSO)('papel %p recebe 403 e nenhum dado é tocado', async (papel) => {
    const res = await request(criarApp())[metodo](url).set('x-papel', papel);

    expect(res.status).toBe(403);
    expect(res.body.erro).toBe('Acesso restrito a professores.');
    expect(db.alertaMonitoria.findMany).not.toHaveBeenCalled();
    expect(db.alertaMonitoria.update).not.toHaveBeenCalled();
  });

  it('sem aluno na requisição também é 403 (nega quando falta informação)', async () => {
    const res = await request(criarApp())[metodo](url).set('x-sem-aluno', '1');

    expect(res.status).toBe(403);
    expect(db.alertaMonitoria.findMany).not.toHaveBeenCalled();
    expect(db.alertaMonitoria.update).not.toHaveBeenCalled();
  });
});

describe('a autorização vem antes da validação', () => {
  it('aluno com id inválido recebe 403, não 400', async () => {
    const res = await request(criarApp()).patch('/monitoria/alertas/abc/atender').set('x-papel', 'ALUNO');
    expect(res.status).toBe(403);
  });

  it('professor com id inválido passa da autorização e recebe 400', async () => {
    const res = await request(criarApp()).patch('/monitoria/alertas/abc/atender').set('x-papel', 'PROFESSOR');
    expect(res.status).toBe(400);
  });
});

describe('professor', () => {
  it('lista os alertas pendentes', async () => {
    db.alertaMonitoria.findMany.mockResolvedValue([]);

    const res = await request(criarApp()).get('/monitoria/alertas').set('x-papel', 'PROFESSOR');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(db.alertaMonitoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PENDENTE' } }),
    );
  });

  it('marca o alerta como atendido', async () => {
    db.alertaMonitoria.update.mockResolvedValue({ id: ALERTA, status: 'ATENDIDO' });

    const res = await request(criarApp())
      .patch(`/monitoria/alertas/${ALERTA}/atender`)
      .set('x-papel', 'PROFESSOR');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: ALERTA, status: 'ATENDIDO' });
    expect(db.alertaMonitoria.update).toHaveBeenCalledWith({
      where: { id: ALERTA },
      data: { status: 'ATENDIDO', atendidoEm: expect.any(Date) },
    });
  });
});
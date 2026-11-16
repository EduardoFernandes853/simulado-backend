import type { Request, Response } from 'express';
import { prisma } from '../prisma';
import { exigirProfessor, requireAuth } from './auth';

const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } }),
}));
jest.mock('../prisma', () => ({
  prisma: { aluno: { findUnique: jest.fn(), create: jest.fn() } },
}));

const db = prisma as unknown as { aluno: { findUnique: jest.Mock; create: jest.Mock } };
const res = {} as Response;

const requisicao = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as unknown as Request;

const usuario = (meta: Record<string, unknown> = {}) => ({
  data: {
    user: {
      id: 'auth-1',
      email: 'maria@ifpa.edu.br',
      user_metadata: { nome: 'Maria Souza', matricula: '20260001', ...meta },
    },
  },
  error: null,
});

beforeEach(() => jest.resetAllMocks());

describe('requireAuth', () => {
  it('401 sem cabeçalho Authorization', async () => {
    const next = jest.fn();
    await expect(requireAuth(requisicao(), res, next)).rejects.toMatchObject({ status: 401 });
    expect(next).not.toHaveBeenCalled();
  });

  it('401 quando o esquema não é Bearer', async () => {
    await expect(requireAuth(requisicao('Basic abc'), res, jest.fn())).rejects.toMatchObject({ status: 401 });
  });

  it('401 quando o Supabase recusa o token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } });
    await expect(requireAuth(requisicao('Bearer ruim'), res, jest.fn())).rejects.toMatchObject({ status: 401 });
  });

  it('anexa o aluno existente e chama next', async () => {
    const aluno = { id: 'a1', authId: 'auth-1', papel: 'ALUNO' };
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.findUnique.mockResolvedValue(aluno);
    const req = requisicao('Bearer ok');
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.aluno).toBe(aluno);
    expect(next).toHaveBeenCalledTimes(1);
    expect(db.aluno.create).not.toHaveBeenCalled();
  });

  it('cria o cadastro no primeiro acesso', async () => {
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.findUnique.mockResolvedValue(null);
    db.aluno.create.mockResolvedValue({ id: 'a2', authId: 'auth-1', papel: 'ALUNO' });
    const next = jest.fn();

    await requireAuth(requisicao('Bearer ok'), res, next);

    expect(db.aluno.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authId: 'auth-1', matricula: '20260001' }),
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('403 quando falta a matrícula', async () => {
    mockGetUser.mockResolvedValue(usuario({ matricula: '' }));
    db.aluno.findUnique.mockResolvedValue(null);
    await expect(requireAuth(requisicao('Bearer ok'), res, jest.fn())).rejects.toMatchObject({ status: 403 });
    expect(db.aluno.create).not.toHaveBeenCalled();
  });

  it('tolera corrida: outra requisição criou o aluno primeiro', async () => {
    const criado = { id: 'a3', authId: 'auth-1', papel: 'ALUNO' };
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(criado);
    db.aluno.create.mockRejectedValue(new Error('unique'));
    const req = requisicao('Bearer ok');

    await requireAuth(req, res, jest.fn());

    expect(req.aluno).toBe(criado);
  });

  it('o papel nunca vem do metadata, que o próprio usuário edita', async () => {
    mockGetUser.mockResolvedValue(usuario({ papel: 'PROFESSOR' }));
    db.aluno.findUnique.mockResolvedValue(null);
    db.aluno.create.mockResolvedValue({ id: 'a4', papel: 'ALUNO' });

    await requireAuth(requisicao('Bearer ok'), res, jest.fn());

    expect(db.aluno.create.mock.calls[0][0].data).not.toHaveProperty('papel');
  });
});

describe('exigirProfessor', () => {
  it('bloqueia aluno comum (403)', () => {
    const next = jest.fn();
    expect(() => exigirProfessor({ aluno: { papel: 'ALUNO' } } as unknown as Request, res, next)).toThrow(
      'Acesso restrito a professores.',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('libera professor', () => {
    const next = jest.fn();
    exigirProfessor({ aluno: { papel: 'PROFESSOR' } } as unknown as Request, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
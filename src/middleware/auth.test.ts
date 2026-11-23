import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../prisma';
import { exigirProfessor, requireAuth } from './auth';
import { cadastroPublicoFechado } from '../services/configAuth';

const mockGetUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (...args: unknown[]) => mockGetUser(...args) } }),
}));
jest.mock('../prisma', () => ({
  prisma: { aluno: { findUnique: jest.fn(), create: jest.fn() } },
}));
jest.mock('../services/configAuth', () => ({ cadastroPublicoFechado: jest.fn() }));

const mockFechado = cadastroPublicoFechado as jest.Mock;
const db = prisma as unknown as { aluno: { findUnique: jest.Mock; create: jest.Mock } };
const res = {} as Response;
const requisicao = (authorization?: string) =>
  ({ headers: authorization ? { authorization } : {} }) as unknown as Request;

const MATRICULA = '20260001';
const EMAIL = `${MATRICULA}@${config.DOMINIO_ALUNO}`;

const usuario = (extra: { email?: string; confirmado?: string | null; meta?: Record<string, unknown> } = {}) => ({
  data: {
    user: {
      id: 'auth-1',
      email: extra.email ?? EMAIL,
      email_confirmed_at: extra.confirmado === undefined ? '2026-11-01T12:00:00Z' : extra.confirmado,
      user_metadata: { nome: 'Maria Souza', ...extra.meta },
    },
  },
  error: null,
});

const listaOriginal = config.EMAILS_PROFESSORES;
beforeEach(() => jest.resetAllMocks());
afterEach(() => { config.EMAILS_PROFESSORES = listaOriginal; });

describe('requireAuth: sessão', () => {
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

  it('anexa o aluno existente e NÃO revalida o e-mail (contas antigas continuam entrando)', async () => {
    const aluno = { id: 'a1', authId: 'auth-1', papel: 'ALUNO' };
    mockGetUser.mockResolvedValue(usuario({ email: 'antigo@gmail.com', confirmado: null }));
    db.aluno.findUnique.mockResolvedValue(aluno);
    const req = requisicao('Bearer ok');
    const next = jest.fn();

    await requireAuth(req, res, next);

    expect(req.aluno).toBe(aluno);
    expect(next).toHaveBeenCalledTimes(1);
    expect(db.aluno.create).not.toHaveBeenCalled();
  });
});

describe('requireAuth: primeiro acesso', () => {
  beforeEach(() => {
    db.aluno.findUnique.mockResolvedValue(null);
    mockFechado.mockResolvedValue(true);
  });

  it('cria o cadastro com a matrícula derivada do e-mail', async () => {
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.create.mockResolvedValue({ id: 'a2', authId: 'auth-1', papel: 'ALUNO' });
    const next = jest.fn();

    await requireAuth(requisicao('Bearer ok'), res, next);

    expect(db.aluno.create).toHaveBeenCalledWith({
      data: { authId: 'auth-1', email: EMAIL, nome: 'Maria Souza', matricula: MATRICULA, papel: 'ALUNO' },
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignora a matrícula e o papel dos metadados, que o próprio usuário edita', async () => {
    mockGetUser.mockResolvedValue(usuario({ meta: { matricula: '99999999', papel: 'PROFESSOR' } }));
    db.aluno.create.mockResolvedValue({ id: 'a3', papel: 'ALUNO' });

    await requireAuth(requisicao('Bearer ok'), res, jest.fn());

    const dados = db.aluno.create.mock.calls[0][0].data;
    expect(dados.matricula).toBe(MATRICULA);
    expect(dados.papel).toBe('ALUNO');
  });

  it('usa o início do e-mail como nome quando o nome informado é inválido', async () => {
    mockGetUser.mockResolvedValue(usuario({ meta: { nome: 'x' } }));
    db.aluno.create.mockResolvedValue({ id: 'a4', papel: 'ALUNO' });

    await requireAuth(requisicao('Bearer ok'), res, jest.fn());

    expect(db.aluno.create.mock.calls[0][0].data.nome).toBe(MATRICULA);
  });

  it.each([
    ['e-mail fora do domínio', 'maria@gmail.com'],
    ['domínio parecido', `${MATRICULA}@${config.DOMINIO_ALUNO}.evil.com`],
    ['servidor fora da lista', 'servidor@ifpa.edu.br'],
  ])('403 para %s', async (_motivo, email) => {
    mockGetUser.mockResolvedValue(usuario({ email }));
    await expect(requireAuth(requisicao('Bearer ok'), res, jest.fn())).rejects.toMatchObject({ status: 403 });
    expect(db.aluno.create).not.toHaveBeenCalled();
  });

  it('403 quando o e-mail não foi confirmado', async () => {
    mockGetUser.mockResolvedValue(usuario({ confirmado: null }));
    await expect(requireAuth(requisicao('Bearer ok'), res, jest.fn())).rejects.toMatchObject({
      status: 403,
      message: 'Confirme seu e-mail para continuar.',
    });
    expect(db.aluno.create).not.toHaveBeenCalled();
  });

  it('503 quando o cadastro público do Supabase está aberto', async () => {
    mockFechado.mockResolvedValue(false);
    mockGetUser.mockResolvedValue(usuario());
    await expect(requireAuth(requisicao('Bearer ok'), res, jest.fn())).rejects.toMatchObject({ status: 503 });
    expect(db.aluno.create).not.toHaveBeenCalled();
  });

  it('servidor da lista de professores entra como PROFESSOR', async () => {
    config.EMAILS_PROFESSORES = ['ana.silva@ifpa.edu.br'];
    mockGetUser.mockResolvedValue(usuario({ email: 'ana.silva@ifpa.edu.br' }));
    db.aluno.create.mockResolvedValue({ id: 'p1', papel: 'PROFESSOR' });

    await requireAuth(requisicao('Bearer ok'), res, jest.fn());

    expect(db.aluno.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ papel: 'PROFESSOR', matricula: 'prof-ana.silva' }),
    });
  });

  it('tolera corrida: outra requisição criou o aluno primeiro', async () => {
    const criado = { id: 'a5', authId: 'auth-1', papel: 'ALUNO' };
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(criado);
    db.aluno.create.mockRejectedValue(new Error('unique'));
    const req = requisicao('Bearer ok');

    await requireAuth(req, res, jest.fn());

    expect(req.aluno).toBe(criado);
  });

  it('409 quando a matrícula já pertence a outra conta', async () => {
    mockGetUser.mockResolvedValue(usuario());
    db.aluno.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '5.22.0', meta: { target: ['matricula'] } }),
    );
    await expect(requireAuth(requisicao('Bearer ok'), res, jest.fn())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('matrícula'),
    });
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
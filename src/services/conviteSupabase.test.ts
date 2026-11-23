import { config } from '../config';
import { prisma } from '../prisma';
import { depsSupabase } from './conviteSupabase';

const mockDelete = jest.fn();
const mockInvite = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        deleteUser: (...a: unknown[]) => mockDelete(...a),
        inviteUserByEmail: (...a: unknown[]) => mockInvite(...a),
      },
    },
  }),
}));

jest.mock('../prisma', () => ({ prisma: { $queryRaw: jest.fn() } }));

const db = prisma as unknown as { $queryRaw: jest.Mock };
const destino = config.FRONT_URL ?? config.CORS_ORIGINS.split(',')[0].trim();

beforeEach(() => jest.resetAllMocks());

describe('buscarUsuario', () => {
  it('devolve o usuário encontrado', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 'u1', confirmado: true }]);
    await expect(depsSupabase.buscarUsuario('a@x.com')).resolves.toEqual({ id: 'u1', confirmado: true });
  });

  it('devolve null quando não existe', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(depsSupabase.buscarUsuario('a@x.com')).resolves.toBeNull();
  });

  it('passa o e-mail como parâmetro da consulta, sem concatenar SQL', async () => {
    db.$queryRaw.mockResolvedValue([]);
    await depsSupabase.buscarUsuario("x'; DROP TABLE alunos;--@a.com");
    expect(db.$queryRaw.mock.calls[0][0].values).toContain("x'; DROP TABLE alunos;--@a.com");
  });
});

describe('removerUsuario', () => {
  it('remove pelo id', async () => {
    mockDelete.mockResolvedValue({ error: null });
    await depsSupabase.removerUsuario('u1');
    expect(mockDelete).toHaveBeenCalledWith('u1');
  });

  it('502 quando o Supabase recusa', async () => {
    mockDelete.mockResolvedValue({ error: { message: 'x' } });
    await expect(depsSupabase.removerUsuario('u1')).rejects.toMatchObject({ status: 502 });
  });
});

describe('convidar', () => {
  it('envia o convite com o nome e o destino do front', async () => {
    mockInvite.mockResolvedValue({ error: null });
    await depsSupabase.convidar('a@x.com', { nome: 'Maria Souza' });
    expect(mockInvite).toHaveBeenCalledWith('a@x.com', { data: { nome: 'Maria Souza' }, redirectTo: destino });
  });

  it('429 quando o limite de e-mails do projeto estourou', async () => {
    mockInvite.mockResolvedValue({ error: { code: 'over_email_send_rate_limit', message: 'x' } });
    await expect(depsSupabase.convidar('a@x.com', { nome: 'M' })).rejects.toMatchObject({ status: 429 });
  });

  it('502 para outros erros, sem vazar o texto original', async () => {
    mockInvite.mockResolvedValue({ error: { code: 'unexpected', message: 'detalhe interno' } });
    await expect(depsSupabase.convidar('a@x.com', { nome: 'M' })).rejects.toMatchObject({
      status: 502,
      message: expect.not.stringContaining('detalhe interno'),
    });
  });
});
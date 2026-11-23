import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { ErroHttp, statusHttpDoErro, tratarErros } from './erros';
import { registrarErro } from '../observabilidade';

jest.mock('../observabilidade', () => ({ registrarErro: jest.fn() }));
const registrar = registrarErro as jest.Mock;

const prismaErro = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('detalhe interno', { code, clientVersion: '5.22.0' });
const zodErro = () => {
  const r = z.object({ a: z.string() }).safeParse({});
  if (r.success) throw new Error('o teste precisa de um erro do Zod');
  return r.error;
};
const comStatus = (status: unknown) => Object.assign(new Error('x'), { status });

describe('statusHttpDoErro', () => {
  it.each([
    ['ZodError', zodErro(), 400],
    ['JSON inválido', new SyntaxError('x'), 400],
    ['ErroHttp 409', new ErroHttp(409, 'x'), 409],
    ['ErroHttp 502', new ErroHttp(502, 'x'), 502],
    ['Prisma P2002', prismaErro('P2002'), 409],
    ['Prisma P2025', prismaErro('P2025'), 404],
    ['Prisma desconhecido', prismaErro('P1001'), 500],
    ['corpo grande demais (body-parser)', comStatus(413), 413],
    ['erro de biblioteca com status 400', comStatus(400), 400],
    ['status fora da faixa de erro', comStatus(302), 500],
    ['status em texto', comStatus('413'), 500],
    ['erro comum', new Error('x'), 500],
    ['valor que nem é erro', 'texto', 500],
    ['null', null, 500],
  ])('%s', (_nome, erro, esperado) => expect(statusHttpDoErro(erro)).toBe(esperado));
});

function executar(erro: unknown) {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  tratarErros(erro, {} as Request, res as unknown as Response, jest.fn());
  return res;
}

describe('tratarErros', () => {
  let silenciar: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    silenciar = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => silenciar.mockRestore());

  it('erro inesperado: 500 genérico, sem vazar a mensagem, e registra no monitoramento', () => {
    const erro = new Error('senha do banco: segredo');
    const res = executar(erro);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro interno no servidor.' });
    expect(registrar).toHaveBeenCalledWith(erro);
  });

  it('Prisma desconhecido: 500 sem vazar detalhe, e registra', () => {
    const res = executar(prismaErro('P1001'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('detalhe interno');
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('ErroHttp 5xx: mostra a mensagem própria e registra', () => {
    const res = executar(new ErroHttp(502, 'Não foi possível enviar o convite agora.'));
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Não foi possível enviar o convite agora.' });
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('ErroHttp 4xx: mostra a mensagem e NÃO registra (é erro do usuário, não do sistema)', () => {
    const res = executar(new ErroHttp(409, 'Tentativa já finalizada.'));
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Tentativa já finalizada.' });
    expect(registrar).not.toHaveBeenCalled();
  });

  it('Zod: 400 com os campos, sem registrar', () => {
    const res = executar(zodErro());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ erro: 'Dados inválidos.', campos: expect.anything() }));
    expect(registrar).not.toHaveBeenCalled();
  });

  it('JSON inválido: 400', () => {
    const res = executar(new SyntaxError('x'));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'JSON inválido.' });
  });

  it.each([
    ['P2002', 409, 'Registro já existe.'],
    ['P2025', 404, 'Registro não encontrado.'],
  ])('Prisma %s: %s, sem registrar', (code, status, mensagem) => {
    const res = executar(prismaErro(code));
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ erro: mensagem });
    expect(registrar).not.toHaveBeenCalled();
  });

  it('corpo grande demais: 413 em português, sem registrar', () => {
    const res = executar(comStatus(413));
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Corpo da requisição grande demais.' });
    expect(registrar).not.toHaveBeenCalled();
  });

  it('outro erro 4xx de biblioteca: mensagem genérica, sem registrar', () => {
    const res = executar(comStatus(400));
    expect(res.json).toHaveBeenCalledWith({ erro: 'Requisição inválida.' });
    expect(registrar).not.toHaveBeenCalled();
  });
});
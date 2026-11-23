import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { registrarErro } from '../observabilidade';

export class ErroHttp extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

// Erros de bibliotecas (ex.: body-parser) trazem o status em err.status.
function statusDeBiblioteca(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  const s = status ?? statusCode;
  return typeof s === 'number' && Number.isInteger(s) && s >= 400 && s <= 599 ? s : null;
}

/** Fonte única de "qual status HTTP este erro vira": a resposta e o monitoramento usam a mesma regra. */
export function statusHttpDoErro(err: unknown): number {
  if (err instanceof ZodError || err instanceof SyntaxError) return 400;
  if (err instanceof ErroHttp) return err.status;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return 409;
    if (err.code === 'P2025') return 404;
    return 500;
  }
  return statusDeBiblioteca(err) ?? 500;
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = statusHttpDoErro(err);

  if (status >= 500) {
    console.error(err); // detalhes só no log do servidor
    registrarErro(err);
    res.status(status).json({ erro: err instanceof ErroHttp ? err.message : 'Erro interno no servidor.' });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ erro: 'Dados inválidos.', campos: err.flatten().fieldErrors });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ erro: 'JSON inválido.' });
    return;
  }
  if (err instanceof ErroHttp) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    res.status(status).json({ erro: status === 409 ? 'Registro já existe.' : 'Registro não encontrado.' });
    return;
  }
  res.status(status).json({ erro: status === 413 ? 'Corpo da requisição grande demais.' : 'Requisição inválida.' });
}
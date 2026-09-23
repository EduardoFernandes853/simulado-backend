import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ErroHttp extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
  }
}

export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
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
    if (err.code === 'P2002') { res.status(409).json({ erro: 'Registro já existe.' }); return; }
    if (err.code === 'P2025') { res.status(404).json({ erro: 'Registro não encontrado.' }); return; }
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
}
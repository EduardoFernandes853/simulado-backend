import type { NextFunction, Request, Response } from 'express';
import { ErroHttp } from '../middleware/erros';
import { prisma } from '../prisma';

const real = jest.requireActual<typeof import('../middleware/auth')>('../middleware/auth');

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const id = String(req.headers['x-aluno-id'] ?? '');
  if (!id) throw new ErroHttp(401, 'Token ausente.');
  const aluno = await prisma.aluno.findUnique({ where: { id } });
  if (!aluno) throw new ErroHttp(401, 'Sessão inválida ou expirada.');
  req.aluno = aluno;
  next();
}

export const exigirProfessor = real.exigirProfessor;
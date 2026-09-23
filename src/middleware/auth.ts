import type { NextFunction, Request, Response } from 'express';
import type { Aluno } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { prisma } from '../prisma';
import { ErroHttp } from './erros';

declare global {
  namespace Express {
    interface Request {
      aluno?: Aluno;
    }
  }
}

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';

  if (!token) throw new ErroHttp(401, 'Token ausente.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ErroHttp(401, 'Sessão inválida ou expirada.');

  const user = data.user;
  let aluno = await prisma.aluno.findUnique({ where: { authId: user.id } });

  if (!aluno) {
    const matricula = String(user.user_metadata?.matricula ?? '').trim();
    if (!user.email || !matricula) throw new ErroHttp(403, 'Cadastro incompleto: matrícula obrigatória.');
    const nome = String(user.user_metadata?.nome ?? user.email.split('@')[0]).trim();
    try {
      aluno = await prisma.aluno.create({ data: { authId: user.id, email: user.email, matricula, nome } });
    } catch (e) {
      aluno = await prisma.aluno.findUnique({ where: { authId: user.id } });
      if (!aluno) throw e;
    }
  }

  req.aluno = aluno;
  next();
}

export function exigirProfessor(req: Request, _res: Response, next: NextFunction) {
  if (req.aluno?.papel !== 'PROFESSOR') throw new ErroHttp(403, 'Acesso restrito a professores.');
  next();
}
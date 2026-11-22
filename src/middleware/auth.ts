import type { NextFunction, Request, Response } from 'express';
import type { Aluno } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { config } from '../config';
import { identificarPeloEmail } from '../domain/identidade';
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

async function criarCadastro(user: User): Promise<Aluno> {
  // Só um e-mail CONFIRMADO vale como prova de identidade.
  if (!user.email_confirmed_at) throw new ErroHttp(403, 'Confirme seu e-mail para continuar.');

  const email = (user.email ?? '').trim().toLowerCase();
  const identidade = identificarPeloEmail(email, {
    dominioAluno: config.DOMINIO_ALUNO,
    emailsProfessores: config.EMAILS_PROFESSORES,
  });
  if (!identidade) {
    throw new ErroHttp(403, `O cadastro exige e-mail institucional (matrícula@${config.DOMINIO_ALUNO}).`);
  }

  // user_metadata é editável pelo próprio usuário: serve só para o nome, NUNCA para matrícula ou papel.
  const nomeInformado = String(user.user_metadata?.nome ?? '').trim();
  const nome = nomeInformado.length >= 3 && nomeInformado.length <= 120 ? nomeInformado : email.split('@')[0];

  try {
    return await prisma.aluno.create({
      data: { authId: user.id, email, nome, matricula: identidade.matricula, papel: identidade.papel },
    });
  } catch (e) {
    const existente = await prisma.aluno.findUnique({ where: { authId: user.id } }); // requisições simultâneas
    if (existente) return existente;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const campo = String(e.meta?.target ?? '');
      throw new ErroHttp(
        409,
        campo.includes('matricula')
          ? 'Esta matrícula já está vinculada a outra conta. Procure a coordenação do curso.'
          : 'Já existe um cadastro com estes dados.',
      );
    }
    throw e;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  if (!token) throw new ErroHttp(401, 'Token ausente.');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new ErroHttp(401, 'Sessão inválida ou expirada.');

  req.aluno =
    (await prisma.aluno.findUnique({ where: { authId: data.user.id } })) ?? (await criarCadastro(data.user));
  next();
}

export function exigirProfessor(req: Request, _res: Response, next: NextFunction) {
  if (req.aluno?.papel !== 'PROFESSOR') throw new ErroHttp(403, 'Acesso restrito a professores.');
  next();
}
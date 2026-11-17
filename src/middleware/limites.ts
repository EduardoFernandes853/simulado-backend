import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const MENSAGEM = { erro: 'Muitas requisições. Aguarde um instante.' };

interface Opcoes { limite: number; janelaMs?: number }

export function criarLimitePorIp({ limite, janelaMs = 60_000 }: Opcoes) {
  return rateLimit({ windowMs: janelaMs, limit: limite, standardHeaders: 'draft-7', legacyHeaders: false, message: MENSAGEM });
}

/** Rode DEPOIS de requireAuth: a chave é o aluno autenticado, não o IP. */
export function criarLimitePorUsuario({ limite, janelaMs = 60_000 }: Opcoes) {
  return rateLimit({
    windowMs: janelaMs,
    limit: limite,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: MENSAGEM,
    keyGenerator: (req: Request) => req.aluno?.id ?? 'anonimo',
  });
}
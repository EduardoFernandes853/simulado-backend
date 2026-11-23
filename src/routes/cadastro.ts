import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { criarCooldown } from '../domain/cooldown';
import { ErroHttp } from '../middleware/erros';
import { criarLimitePorIp } from '../middleware/limites';
import { solicitarConvite } from '../services/convite';
import { depsSupabase } from '../services/conviteSupabase';

const Corpo = z.object({
  email: z.string().trim().toLowerCase().max(254),
  nome: z.string().trim().min(3, 'Informe o nome completo.').max(120),
});

const MENSAGEM =
  'Se o e-mail puder ser cadastrado, você receberá o convite em instantes. Se já tem conta, use "Entrar" ou "Esqueci minha senha".';

const limitePorIp = criarLimitePorIp({ limite: config.RATE_LIMIT_CADASTRO_POR_MIN });
const cooldown = criarCooldown(60_000);

export const cadastroRouter = Router();

// Pública, de propósito: quem ainda não tem conta não pode estar logado.
cadastroRouter.post('/', limitePorIp, async (req, res) => {
  const { email, nome } = Corpo.parse(req.body);
  // Vale para qualquer e-mail, exista conta ou não: não revela quem está cadastrado.
  if (!cooldown.liberar(email)) throw new ErroHttp(429, 'Aguarde 1 minuto antes de pedir outro convite.');

  await solicitarConvite(
    { email, nome },
    { dominioAluno: config.DOMINIO_ALUNO, emailsProfessores: config.EMAILS_PROFESSORES },
    depsSupabase,
  );
  // Mesma resposta para "enviado" e "já cadastrado".
  res.status(202).json({ mensagem: MENSAGEM });
});
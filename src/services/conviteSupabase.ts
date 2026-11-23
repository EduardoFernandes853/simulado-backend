import { Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErroHttp } from '../middleware/erros';
import { prisma } from '../prisma';
import type { DepsConvite } from './convite';

// Chave com poder administrativo: só no servidor, nunca no front, nunca no repositório.
const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const destinoDoConvite = () => config.FRONT_URL ?? config.CORS_ORIGINS.split(',')[0].trim();

export const depsSupabase: DepsConvite = {
  async buscarUsuario(email) {
    const linhas = await prisma.$queryRaw<{ id: string; confirmado: boolean }[]>(Prisma.sql`
      SELECT id::text AS id, (email_confirmed_at IS NOT NULL) AS confirmado
      FROM auth.users WHERE lower(email) = ${email} LIMIT 1`);
    return linhas[0] ?? null;
  },

  async removerUsuario(id) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new ErroHttp(502, 'Não foi possível processar o pedido agora.');
  },

  async convidar(email, dados) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: dados, redirectTo: destinoDoConvite() });
    if (!error) return;
    if (error.code === 'over_email_send_rate_limit') {
      throw new ErroHttp(429, 'Muitos e-mails enviados. Tente de novo em alguns minutos.');
    }
    throw new ErroHttp(502, 'Não foi possível enviar o convite agora.');
  },
};
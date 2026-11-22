import { config as carregarEnv } from 'dotenv';
carregarEnv({ quiet: true });
import { z } from 'zod';
import { DOMINIO_ALUNO as DOMINIO_PADRAO } from './contracts';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LIMIAR_MONITORIA: z.coerce.number().min(0).max(100).default(60),
  RATE_LIMIT_POR_MIN: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_ESCRITA_POR_MIN: z.coerce.number().int().positive().default(30),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  DOMINIO_ALUNO: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase().min(3).default(DOMINIO_PADRAO)),
  // e-mails de servidores que podem abrir conta já como professor (separados por vírgula)
  EMAILS_PROFESSORES: z.string().default('').transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
});

export const config = schema.parse(process.env);
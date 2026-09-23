import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LIMIAR_MONITORIA: z.coerce.number().min(0).max(100).default(60),
});

export const config = schema.parse(process.env);
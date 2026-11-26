import { config } from 'dotenv';
import { validarUrlDeTeste } from './src/domain/urlTeste';

config({ quiet: true });

const url = process.env.DATABASE_URL_TESTE;
if (!url) {
  throw new Error('Defina DATABASE_URL_TESTE no .env: os testes de integração nunca usam o banco de produção.');
}
validarUrlDeTeste(url);

// o Prisma lê estas duas; o dotenv do config.ts não sobrescreve variáveis já definidas
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { validarUrlDeTeste } from '../src/domain/urlTeste';

config({ quiet: true });

const url = process.env.DATABASE_URL_TESTE;
if (!url) {
  console.error('Defina DATABASE_URL_TESTE no .env.');
  process.exit(1);
}
validarUrlDeTeste(url);

// aplica as migrações SÓ no banco de teste, ignorando o DATABASE_URL de produção do .env
execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
});
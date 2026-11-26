const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '[::1]'];

/** Os testes de integração apagam todas as tabelas: só podem rodar contra um Postgres LOCAL de teste. */
export function validarUrlDeTeste(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error('DATABASE_URL_TESTE não é uma URL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(u.protocol)) {
    throw new Error('DATABASE_URL_TESTE precisa ser uma URL postgresql://.');
  }

  if (!HOSTS_LOCAIS.includes(u.hostname)) {
    throw new Error(`Recusado: o host "${u.hostname}" não é local. Os testes de integração só rodam em localhost.`);
  }

  const banco = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!/test/i.test(banco)) {
    throw new Error(`Recusado: o banco "${banco}" não parece ser de teste (o nome precisa conter "test" ou "teste").`);
  }
}
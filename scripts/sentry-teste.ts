import '../src/instrument';

const Sentry = require('@sentry/node') as typeof import('@sentry/node');

Sentry.setUser({ id: 'usuario-de-teste', email: 'nao.deve.aparecer@aluno.ifpa.edu.br' });
Sentry.captureException(new Error('Teste de integração (pode ignorar): matrícula 202438305315, e-mail 202438305315@aluno.ifpa.edu.br'));

void Sentry.flush(5000).then((ok) => {
  console.log(ok ? 'Evento enviado.' : 'O envio não foi confirmado.');
  process.exit(ok ? 0 : 1);
});
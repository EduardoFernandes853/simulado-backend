import { config } from './config';
import { limparEventoOuDescartar } from './domain/privacidade';

// Este arquivo precisa ser o PRIMEIRO import do server.ts: o Sentry instrumenta os módulos que carregam depois.
if (config.SENTRY_DSN) {
  const Sentry = require('@sentry/node') as typeof import('@sentry/node');

  // A captura de erros do Express é desligada de propósito: capturamos nós mesmos em tratarErros,
  // só quando o erro vira 5xx. O cast permite versões do SDK com e sem essa opção.
  const expressSemCapturaAutomatica = (
    Sentry.expressIntegration as (opcoes?: unknown) => ReturnType<typeof Sentry.expressIntegration>
  )({ shouldHandleError: false });

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT,
    release: process.env.RENDER_GIT_COMMIT,
    tracesSampleRate: 0, // só erros: sem tráfego de desempenho
    integrations: [expressSemCapturaAutomatica],
    beforeSend: (evento) => limparEventoOuDescartar(evento),
  });
}
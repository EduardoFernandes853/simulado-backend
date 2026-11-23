import { config } from './config';

/** Registra um erro inesperado no Sentry. Sem DSN (desenvolvimento e testes) o Sentry nem é carregado. */
export function registrarErro(err: unknown): void {
  if (!config.SENTRY_DSN) return;
  const Sentry = require('@sentry/node') as typeof import('@sentry/node');
  Sentry.captureException(err);
}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { comTimeout } from './domain/timeout';
import { prisma } from './prisma';
import { tratarErros } from './middleware/erros';
import { criarLimitePorIp } from './middleware/limites';
import { simuladosRouter } from './routes/simulados';
import { tentativasRouter } from './routes/tentativas';
import { monitoriaRouter } from './routes/monitoria';
import { cadastroRouter } from './routes/cadastro';
import { criarContaRouter } from './routes/conta';

interface Opcoes {
  limiteIpPorMin?: number;
  limiteSensivelPorMin?: number;
}

export function criarApp({
  limiteIpPorMin = config.RATE_LIMIT_POR_MIN,
  limiteSensivelPorMin = config.RATE_LIMIT_SENSIVEL_POR_MIN,
}: Opcoes = {}) {
  const app = express();

  app.set('trust proxy', config.TRUST_PROXY_HOPS); // atrás do proxy do provedor
  app.use(helmet());

  // CORS antes do limitador: um 429 sem cabeçalhos CORS aparece no navegador como erro de CORS.
  app.use(cors({ origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()) }));

  // Fora do limite: o selo "Sistema operacional" e o monitoramento batem aqui o tempo todo.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', hora: new Date().toISOString() });
  });

  app.use(criarLimitePorIp({ limite: limiteIpPorMin }));

  app.get('/health/db', async (_req, res) => {
    const hora = new Date().toISOString();
    try {
      await comTimeout(prisma.simulado.findFirst({ select: { id: true } }), 4000);
      res.json({ status: 'ok', banco: 'ok', hora });
    } catch {
      res.status(503).json({ status: 'degradado', banco: 'indisponivel', hora });
    }
  });

  app.use(express.json({ limit: '100kb' }));
  app.use('/cadastro', cadastroRouter);
  app.use('/me', criarContaRouter(limiteSensivelPorMin));
  app.use('/simulados', simuladosRouter);
  app.use('/tentativas', tentativasRouter);
  app.use('/monitoria', monitoriaRouter);

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
  });
  app.use(tratarErros);

  return app;
}
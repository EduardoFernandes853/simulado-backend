import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { comTimeout } from './domain/timeout';
import { prisma } from './prisma';
import { requireAuth } from './middleware/auth';
import { tratarErros } from './middleware/erros';
import { criarLimitePorIp } from './middleware/limites';
import { simuladosRouter } from './routes/simulados';
import { tentativasRouter } from './routes/tentativas';
import { monitoriaRouter } from './routes/monitoria';
import { cadastroRouter } from './routes/cadastro';

interface Opcoes { limiteIpPorMin?: number }

export function criarApp({ limiteIpPorMin = config.RATE_LIMIT_POR_MIN }: Opcoes = {}) {
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
  
  app.get('/me', requireAuth, (req, res) => {
    const a = req.aluno!;
    res.json({ id: a.id, nome: a.nome, matricula: a.matricula, email: a.email, papel: a.papel });
  });
  
  app.use('/simulados', simuladosRouter);
  app.use('/tentativas', tentativasRouter);
  app.use('/monitoria', monitoriaRouter);
  
  app.use((_req, res) => { res.status(404).json({ erro: 'Rota não encontrada.' }); });
  app.use(tratarErros);
  
  return app;
}
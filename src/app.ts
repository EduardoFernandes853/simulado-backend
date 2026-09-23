import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requireAuth } from './middleware/auth';
import { tratarErros } from './middleware/erros';
import { simuladosRouter } from './routes/simulados';
import { tentativasRouter } from './routes/tentativas';
import { monitoriaRouter } from './routes/monitoria';

export function criarApp() {
  const app = express();
  
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', hora: new Date().toISOString() });
  });
  
  app.get('/me', requireAuth, (req, res) => {
    const a = req.aluno!;
    res.json({ id: a.id, nome: a.nome, matricula: a.matricula, email: a.email, papel: a.papel });
  });
  
  app.use('/simulados', simuladosRouter);
  app.use('/tentativas', tentativasRouter);
  app.use('/monitoria', monitoriaRouter);
  
  app.use(tratarErros);
  return app;
}
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { requireAuth } from './middleware/auth';
import { tratarErros } from './middleware/erros';
import { simuladosRouter } from './routes/simulados';
import { tentativasRouter } from './routes/tentativas';
import { monitoriaRouter } from './routes/monitoria';
// IMPORTAÇÃO NOVA: Adicionando a instância do Prisma para conectar ao banco
import { prisma } from './prisma'; 

export function criarApp() {
  const app = express();
  
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', hora: new Date().toISOString() });
  });
  
  // ROTA NOVA: Força o Prisma a bater no Supabase para evitar que o projeto seja pausado
  app.get('/health/db', async (_req, res) => {
    try {
      const alunos = await prisma.aluno.count();
      res.json({ status: 'ok', alunos });
    } catch (error) {
      console.error('Erro na verificação do banco:', error);
      res.status(503).json({ status: 'banco indisponível' });
    }
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
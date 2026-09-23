import { Router } from 'express';
import { z } from 'zod';
import { IdSchema } from '../contracts';
import { prisma } from '../prisma';
import { exigirProfessor, requireAuth } from '../middleware/auth';

export const monitoriaRouter = Router();
monitoriaRouter.use(requireAuth, exigirProfessor);

monitoriaRouter.get('/alertas', async (req, res) => {
  const status = z.enum(['PENDENTE', 'ATENDIDO']).default('PENDENTE').parse(req.query.status);
  const alertas = await prisma.alertaMonitoria.findMany({
    where: { status },
    orderBy: { criadoEm: 'desc' },
    include: {
      aluno: { select: { nome: true, matricula: true, email: true } },
      tentativa: { select: { simulado: { select: { titulo: true } } } },
    },
  });
  res.json(
    alertas.map((a) => ({
      id: a.id,
      nota: Number(a.nota),
      limiar: Number(a.limiar),
      status: a.status,
      criadoEm: a.criadoEm.toISOString(),
      aluno: a.aluno,
      simulado: a.tentativa.simulado.titulo,
    }))
  );
});

monitoriaRouter.patch('/alertas/:id/atender', async (req, res) => {
  const id = IdSchema.parse(req.params.id);
  const alerta = await prisma.alertaMonitoria.update({
    where: { id },
    data: { status: 'ATENDIDO', atendidoEm: new Date() },
  });
  res.json({ id: alerta.id, status: alerta.status });
});
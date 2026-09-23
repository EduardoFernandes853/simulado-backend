import { Router } from 'express';
import { IdSchema } from '../contracts';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { ErroHttp } from '../middleware/erros';

export const simuladosRouter = Router();
simuladosRouter.use(requireAuth);

simuladosRouter.get('/', async (_req, res) => {
  const simulados = await prisma.simulado.findMany({
    where: { publicado: true },
    orderBy: { criadoEm: 'desc' },
    include: { _count: { select: { questoes: true } } },
  });
  res.json(
    simulados.map((s) => ({
      id: s.id,
      titulo: s.titulo,
      descricao: s.descricao,
      duracaoMin: s.duracaoMin,
      totalQuestoes: s._count.questoes,
    }))
  );
});

simuladosRouter.post('/:id/tentativas', async (req, res) => {
  const simuladoId = IdSchema.parse(req.params.id);
  const aluno = req.aluno!;
  
  const simulado = await prisma.simulado.findFirst({
    where: { id: simuladoId, publicado: true },
    include: {
      questoes: {
        orderBy: { ordem: 'asc' },
        include: {
          questao: {
            include: {
              topico: { include: { disciplina: true } },
              alternativas: { orderBy: { letra: 'asc' } },
            },
          },
        },
      },
    },
  });
  
  if (!simulado) throw new ErroHttp(404, 'Simulado não encontrado.');
  
  let tentativa = await prisma.tentativa.findFirst({
    where: { alunoId: aluno.id, simuladoId, status: 'EM_ANDAMENTO', prazoEm: { gt: new Date() } },
  });
  
  if (!tentativa) {
    tentativa = await prisma.tentativa.create({
      data: { alunoId: aluno.id, simuladoId, prazoEm: new Date(Date.now() + simulado.duracaoMin * 60_000) },
    });
  }
  
  res.status(201).json({
    tentativaId: tentativa.id,
    titulo: simulado.titulo,
    segundosRestantes: Math.max(0, Math.floor((tentativa.prazoEm.getTime() - Date.now()) / 1000)),
    questoes: simulado.questoes.map((sq) => ({
      id: sq.questao.id,
      enunciado: sq.questao.enunciado,
      disciplina: sq.questao.topico.disciplina.nome,
      topico: sq.questao.topico.nome,
      alternativas: sq.questao.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
    })),
  });
});
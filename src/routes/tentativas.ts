import { Router } from 'express';
import { FinalizarTentativaBodySchema, IdSchema } from '../contracts';
import { config } from '../config';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { ErroHttp } from '../middleware/erros';
import { corrigir } from '../domain/correcao';
import { avaliarDesempenho } from '../domain/desempenho';

const TOLERANCIA_MS = 30_000;

export const tentativasRouter = Router();
tentativasRouter.use(requireAuth);

tentativasRouter.get('/minhas', async (req, res) => {
  const tentativas = await prisma.tentativa.findMany({
    where: { alunoId: req.aluno!.id, status: 'FINALIZADA' },
    orderBy: { finalizadaEm: 'desc' },
    include: { simulado: { select: { titulo: true } }, alerta: { select: { id: true } } },
  });
  res.json(
    tentativas.map((t) => ({
      id: t.id,
      simulado: t.simulado.titulo,
      nota: t.nota === null ? null : Number(t.nota),
      finalizadaEm: t.finalizadaEm?.toISOString() ?? null,
      alertaMonitoria: t.alerta !== null,
    }))
  );
});

tentativasRouter.post('/:id/finalizar', async (req, res) => {
  const id = IdSchema.parse(req.params.id);
  const { respostas } = FinalizarTentativaBodySchema.parse(req.body);
  const aluno = req.aluno!;
  
  const tentativa = await prisma.tentativa.findFirst({ where: { id, alunoId: aluno.id } });
  if (!tentativa) throw new ErroHttp(404, 'Tentativa não encontrada.');
  if (tentativa.status !== 'EM_ANDAMENTO') throw new ErroHttp(409, 'Tentativa já finalizada.');
  
  if (Date.now() > tentativa.prazoEm.getTime() + TOLERANCIA_MS) {
    await prisma.tentativa.update({ where: { id }, data: { status: 'EXPIRADA', finalizadaEm: new Date() } });
    throw new ErroHttp(409, 'Prazo encerrado.');
  }
  
  const itens = await prisma.simuladoQuestao.findMany({
    where: { simuladoId: tentativa.simuladoId },
    include: { questao: { include: { gabarito: true, topico: { include: { disciplina: true } } } } },
  });
  
  const gabarito = itens.map((i) => {
    if (!i.questao.gabarito) throw new ErroHttp(500, `Questão ${i.questaoId} sem gabarito.`);
    return {
      questaoId: i.questaoId,
      correta: i.questao.gabarito.alternativaCorreta,
      disciplina: i.questao.topico.disciplina.nome,
      topico: i.questao.topico.nome,
    };
  });
  
  const resultado = corrigir(gabarito, respostas);
  const { precisaMonitoria } = avaliarDesempenho(resultado.nota, config.LIMIAR_MONITORIA);
  
  await prisma.$transaction(async (tx) => {
    const atualizadas = await tx.tentativa.updateMany({
      where: { id, status: 'EM_ANDAMENTO' },
      data: { status: 'FINALIZADA', finalizadaEm: new Date(), nota: resultado.nota },
    });
    if (atualizadas.count === 0) throw new ErroHttp(409, 'Tentativa já finalizada.');
    
    await tx.resposta.createMany({
      data: resultado.itens
        .filter((i) => i.escolhida !== null)
        .map((i) => ({ tentativaId: id, questaoId: i.questaoId, alternativa: i.escolhida as string, correta: i.correta })),
    });
    
    if (precisaMonitoria) {
      await tx.alertaMonitoria.create({
        data: { tentativaId: id, alunoId: aluno.id, nota: resultado.nota, limiar: config.LIMIAR_MONITORIA },
      });
    }
  });
  
  res.json({
    tentativaId: id,
    nota: resultado.nota,
    acertos: resultado.acertos,
    total: resultado.total,
    porTopico: resultado.porTopico,
    alertaMonitoria: precisaMonitoria,
    limiar: config.LIMIAR_MONITORIA,
  });
});
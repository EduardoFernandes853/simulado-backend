import { Router } from 'express';
import type { Aluno } from '@prisma/client';
import {
  AtualizarPerfilBodySchema,
  CienciaBodySchema,
  ExcluirContaBodySchema,
  VERSAO_AVISO,
} from '../contracts';
import { config } from '../config';
import { prisma } from '../prisma';
import { requireAuth } from '../middleware/auth';
import { ErroHttp } from '../middleware/erros';
import { criarLimitePorUsuario } from '../middleware/limites';
import { depsSupabase } from '../services/conviteSupabase';

const perfil = (a: Aluno) => ({
  id: a.id,
  nome: a.nome,
  matricula: a.matricula,
  email: a.email,
  papel: a.papel,
  avisoVersao: a.avisoVersao ?? null,
});

export function criarContaRouter(limiteSensivelPorMin: number = config.RATE_LIMIT_SENSIVEL_POR_MIN) {
  const router = Router();
  const limiteSensivel = criarLimitePorUsuario({ limite: limiteSensivelPorMin });

  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(perfil(req.aluno!));
  });

  // Direito de correção: só o nome. Matrícula e e-mail vêm do e-mail institucional confirmado.
  router.patch('/', async (req, res) => {
    const { nome } = AtualizarPerfilBodySchema.parse(req.body);
    const atualizado = await prisma.aluno.update({
      where: { id: req.aluno!.id },
      data: { nome },
    });
    res.json(perfil(atualizado));
  });

  // Transparência: registra que o titular viu ESTA versão do aviso. Não é consentimento.
  router.post('/ciencia', async (req, res) => {
    const { versao } = CienciaBodySchema.parse(req.body);
    if (versao !== VERSAO_AVISO) {
      throw new ErroHttp(409, 'O aviso foi atualizado. Recarregue a página e leia a versão nova.');
    }
    const atualizado = await prisma.aluno.update({
      where: { id: req.aluno!.id },
      data: { avisoVersao: versao, avisoAceitoEm: new Date() },
    });
    res.json(perfil(atualizado));
  });

  // Direito de acesso e portabilidade: tudo o que o sistema guarda DESTE aluno.
  router.get('/dados', limiteSensivel, async (req, res) => {
    const aluno = req.aluno!;
    const [tentativas, alertas] = await Promise.all([
      prisma.tentativa.findMany({
        where: { alunoId: aluno.id },
        orderBy: { iniciadaEm: 'asc' },
        include: {
          simulado: { select: { titulo: true } },
          respostas: { select: { questaoId: true, alternativa: true, correta: true } },
        },
      }),
      prisma.alertaMonitoria.findMany({
        where: { alunoId: aluno.id },
        orderBy: { criadoEm: 'asc' },
      }),
    ]);

    res.setHeader('Content-Disposition', 'attachment; filename="meus-dados.json"');
    res.json({
      geradoEm: new Date().toISOString(),
      titular: {
        id: aluno.id,
        nome: aluno.nome,
        matricula: aluno.matricula,
        email: aluno.email,
        papel: aluno.papel,
        criadoEm: aluno.criadoEm.toISOString(),
        avisoVersao: aluno.avisoVersao ?? null,
        avisoAceitoEm: aluno.avisoAceitoEm?.toISOString() ?? null,
      },
      tentativas: tentativas.map((t) => ({
        id: t.id,
        simulado: t.simulado.titulo,
        iniciadaEm: t.iniciadaEm.toISOString(),
        finalizadaEm: t.finalizadaEm?.toISOString() ?? null,
        status: t.status,
        nota: t.nota === null ? null : Number(t.nota),
        respostas: t.respostas.map((r) => ({
          questaoId: r.questaoId,
          alternativa: r.alternativa,
          correta: r.correta,
        })),
      })),
      alertas: alertas.map((a) => ({
        id: a.id,
        nota: Number(a.nota),
        limiar: Number(a.limiar),
        status: a.status,
        criadoEm: a.criadoEm.toISOString(),
        atendidoEm: a.atendidoEm?.toISOString() ?? null,
      })),
    });
  });

  // Direito de eliminação. Dados primeiro (cascata em tentativas, respostas e alertas), login depois:
  // se o login falhar, os dados já sumiram e repetir o pedido termina o serviço.
  router.delete('/', limiteSensivel, async (req, res) => {
    ExcluirContaBodySchema.parse(req.body);
    const aluno = req.aluno!;
    if (aluno.papel !== 'ALUNO') {
      throw new ErroHttp(403, 'Contas de professor são removidas pela coordenação do projeto.');
    }

    await prisma.aluno.delete({ where: { id: aluno.id } });

    try {
      if (aluno.authId) await depsSupabase.removerUsuario(aluno.authId);
    } catch (e) {
      console.error('Falha ao remover o login depois de apagar os dados', e);
      throw new ErroHttp(
        502,
        'Seus dados foram apagados, mas não conseguimos encerrar o login agora. Tente excluir de novo em instantes.',
      );
    }

    res.status(204).end();
  });

  return router;
}
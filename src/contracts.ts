import { z } from 'zod';

export const IdSchema = z.string().uuid();
export const LetraSchema = z.enum(['A', 'B', 'C', 'D', 'E']);

export const AlunoSchema = z.object({
  id: IdSchema,
  nome: z.string(),
  matricula: z.string(),
  email: z.string().email(),
  papel: z.enum(['ALUNO', 'PROFESSOR']),
});

export const SimuladoResumoSchema = z.object({
  id: IdSchema,
  titulo: z.string(),
  descricao: z.string().nullable(),
  duracaoMin: z.number().int(),
  totalQuestoes: z.number().int(),
});
export const ListaSimuladosSchema = z.array(SimuladoResumoSchema);

export const QuestaoProvaSchema = z.object({
  id: IdSchema,
  enunciado: z.string(),
  disciplina: z.string(),
  topico: z.string(),
  alternativas: z.array(z.object({ letra: LetraSchema, texto: z.string() })),
});

export const IniciarTentativaRespostaSchema = z.object({
  tentativaId: IdSchema,
  titulo: z.string(),
  segundosRestantes: z.number().int().nonnegative(),
  questoes: z.array(QuestaoProvaSchema),
});

export const FinalizarTentativaBodySchema = z.object({
  respostas: z.array(z.object({ questaoId: IdSchema, alternativa: LetraSchema })).max(200),
});

export const DesempenhoTopicoSchema = z.object({
  disciplina: z.string(),
  topico: z.string(),
  acertos: z.number().int(),
  total: z.number().int(),
  percentual: z.number(),
});

export const ResultadoTentativaSchema = z.object({
  tentativaId: IdSchema,
  nota: z.number(),
  acertos: z.number().int(),
  total: z.number().int(),
  porTopico: z.array(DesempenhoTopicoSchema),
  alertaMonitoria: z.boolean(),
  limiar: z.number(),
});

export const HistoricoItemSchema = z.object({
  id: IdSchema,
  simulado: z.string(),
  nota: z.number().nullable(),
  finalizadaEm: z.string().nullable(),
  alertaMonitoria: z.boolean(),
});
export const HistoricoSchema = z.array(HistoricoItemSchema);

export const AlertaMonitoriaSchema = z.object({
  id: IdSchema,
  nota: z.number(),
  limiar: z.number(),
  status: z.enum(['PENDENTE', 'ATENDIDO']),
  criadoEm: z.string(),
  aluno: z.object({ nome: z.string(), matricula: z.string(), email: z.string() }),
  simulado: z.string(),
});
export const ListaAlertasSchema = z.array(AlertaMonitoriaSchema);

export const QuestaoRevisaoSchema = z.object({
  questaoId: IdSchema,
  enunciado: z.string(),
  disciplina: z.string(),
  topico: z.string(),
  alternativas: z.array(z.object({ letra: LetraSchema, texto: z.string() })),
  escolhida: LetraSchema.nullable(),
  correta: LetraSchema,
  justificativa: z.string().nullable(),
  acertou: z.boolean(),
});

export const RevisaoSchema = z.object({
  tentativaId: IdSchema,
  simulado: z.string(),
  nota: z.number(),
  questoes: z.array(QuestaoRevisaoSchema),
});

export type Aluno = z.infer<typeof AlunoSchema>;
export type SimuladoResumo = z.infer<typeof SimuladoResumoSchema>;
export type IniciarTentativaResposta = z.infer<typeof IniciarTentativaRespostaSchema>;
export type ResultadoTentativa = z.infer<typeof ResultadoTentativaSchema>;
export type HistoricoItem = z.infer<typeof HistoricoItemSchema>;
export type AlertaMonitoria = z.infer<typeof AlertaMonitoriaSchema>;
export type QuestaoRevisao = z.infer<typeof QuestaoRevisaoSchema>;
export type Revisao = z.infer<typeof RevisaoSchema>;
// ── Identidade institucional ─────────────────────────────────────
export const DOMINIO_ALUNO = 'aluno.ifpa.edu.br';

/**
 * Matrícula derivada do e-mail institucional: exatamente "matrícula@domínio", só dígitos.
 * Recusa subdomínios, sufixos, "+tag" e qualquer coisa fora do padrão.
 * Fonte única: o backend (autoridade) e o front (validação do formulário) usam esta função.
 */
export function matriculaDoEmail(email: string, dominio: string = DOMINIO_ALUNO): string | null {
  const partes = email.trim().toLowerCase().split('@');
  if (partes.length !== 2) return null;
  const [local, dom] = partes;
  if (dom !== dominio.toLowerCase()) return null;
  return /^\d{5,15}$/.test(local) ? local : null;
}
export const ConviteRespostaSchema = z.object({ mensagem: z.string() });
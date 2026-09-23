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

export type Aluno = z.infer<typeof AlunoSchema>;
export type SimuladoResumo = z.infer<typeof SimuladoResumoSchema>;
export type IniciarTentativaResposta = z.infer<typeof IniciarTentativaRespostaSchema>;
export type ResultadoTentativa = z.infer<typeof ResultadoTentativaSchema>;
export type HistoricoItem = z.infer<typeof HistoricoItemSchema>;
export type AlertaMonitoria = z.infer<typeof AlertaMonitoriaSchema>;
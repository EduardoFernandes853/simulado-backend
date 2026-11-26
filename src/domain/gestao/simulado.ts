export type StatusSimulado = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'ARQUIVADO';
export type PoliticaRevisao = 'IMEDIATA' | 'APOS_ENCERRAMENTO' | 'NUNCA';
export type StatusQuestaoDominio = 'RASCUNHO' | 'ATIVA' | 'ARQUIVADA';

export interface SimuladoRegras {
  status: StatusSimulado;
  duracaoMin: number;
  abreEm: Date | null;
  fechaEm: Date | null;
  maxTentativas: number | null;
  revisao: PoliticaRevisao;
}

export type ResultadoInicio =
  | { ok: true }
  | { ok: false; codigo: 'NAO_PUBLICADO' | 'ENCERRADO' | 'AINDA_NAO_ABRIU' | 'LIMITE_ATINGIDO'; motivo: string };

export function podeIniciarTentativa(
  s: SimuladoRegras,
  agora: Date,
  usadas: number,
  temAbertaValida: boolean,
): ResultadoInicio {
  if (s.status === 'ENCERRADO') return { ok: false, codigo: 'ENCERRADO', motivo: 'Este simulado foi encerrado.' };
  if (s.status !== 'PUBLICADO') return { ok: false, codigo: 'NAO_PUBLICADO', motivo: 'Este simulado não está disponível.' };
  if (temAbertaValida) return { ok: true };
  if (s.abreEm && agora.getTime() < s.abreEm.getTime()) {
    return { ok: false, codigo: 'AINDA_NAO_ABRIU', motivo: 'Este simulado ainda não abriu.' };
  }
  if (s.fechaEm && agora.getTime() >= s.fechaEm.getTime()) {
    return { ok: false, codigo: 'ENCERRADO', motivo: 'O prazo deste simulado terminou.' };
  }
  if (s.maxTentativas !== null && usadas >= s.maxTentativas) {
    return { ok: false, codigo: 'LIMITE_ATINGIDO', motivo: 'Você já usou todas as tentativas deste simulado.' };
  }
  return { ok: true };
}

/** O prazo da tentativa nunca passa do fechamento do simulado. */
export function calcularPrazo(agora: Date, duracaoMin: number, fechaEm: Date | null): Date {
  const fim = agora.getTime() + duracaoMin * 60_000;
  return new Date(fechaEm ? Math.min(fim, fechaEm.getTime()) : fim);
}

export function revisaoLiberada(s: SimuladoRegras, agora: Date): boolean {
  if (s.revisao === 'IMEDIATA') return true;
  if (s.revisao === 'NUNCA') return false;
  if (s.status === 'ENCERRADO' || s.status === 'ARQUIVADO') return true;
  return s.fechaEm !== null && agora.getTime() >= s.fechaEm.getTime();
}

export type CampoSimulado =
  | 'titulo'
  | 'descricao'
  | 'duracaoMin'
  | 'abreEm'
  | 'fechaEm'
  | 'maxTentativas'
  | 'revisao'
  | 'questaoIds';

const EDITAVEIS: Record<StatusSimulado, readonly CampoSimulado[]> = {
  RASCUNHO: ['titulo', 'descricao', 'duracaoMin', 'abreEm', 'fechaEm', 'maxTentativas', 'revisao', 'questaoIds'],
  PUBLICADO: ['titulo', 'descricao', 'fechaEm', 'revisao'],
  ENCERRADO: ['titulo', 'descricao', 'revisao'],
  ARQUIVADO: [],
};

export const camposNaoEditaveis = (status: StatusSimulado, alterados: CampoSimulado[]): CampoSimulado[] =>
  alterados.filter((c) => !EDITAVEIS[status].includes(c));

export const podeEditarComposicao = (status: StatusSimulado): boolean => status === 'RASCUNHO';

export interface DadosPublicacao {
  duracaoMin: number;
  abreEm: Date | null;
  fechaEm: Date | null;
  questoes: { id: string; status: StatusQuestaoDominio }[];
}

export function validarPublicacao(d: DadosPublicacao, agora: Date): string[] {
  const problemas: string[] = [];
  if (d.questoes.length === 0) problemas.push('O simulado precisa ter ao menos uma questão.');

  d.questoes.forEach((q, i) => {
    if (q.status !== 'ATIVA') problemas.push(`A questão ${i + 1} não está ativa (rascunho ou arquivada).`);
  });

  if (new Set(d.questoes.map((q) => q.id)).size !== d.questoes.length) problemas.push('Há questões repetidas.');
  if (d.duracaoMin < 5 || d.duracaoMin > 300) problemas.push('A duração deve ficar entre 5 e 300 minutos.');
  if (d.fechaEm && d.fechaEm.getTime() <= agora.getTime()) problemas.push('O fechamento já passou.');
  if (d.abreEm && d.fechaEm && d.fechaEm.getTime() <= d.abreEm.getTime()) {
    problemas.push('O fechamento deve ser depois da abertura.');
  }

  return problemas;
}
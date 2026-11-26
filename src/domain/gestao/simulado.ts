export type StatusSimulado = 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'ARQUIVADO';
export type PoliticaRevisao = 'IMEDIATA' | 'APOS_ENCERRAMENTO' | 'NUNCA';
export interface SimuladoRegras { status: StatusSimulado; duracaoMin: number; abreEm: Date | null; fechaEm: Date | null; maxTentativas: number | null; revisao: PoliticaRevisao; }
export const podeIniciarTentativa = (..._a: unknown[]) => { throw new Error('não implementado'); };
export const calcularPrazo = (..._a: unknown[]) => { throw new Error('não implementado'); };
export const revisaoLiberada = (..._a: unknown[]) => { throw new Error('não implementado'); };
export const camposNaoEditaveis = (..._a: unknown[]) => { throw new Error('não implementado'); };
export const podeEditarComposicao = (..._a: unknown[]) => { throw new Error('não implementado'); };
export const validarPublicacao = (..._a: unknown[]) => { throw new Error('não implementado'); };
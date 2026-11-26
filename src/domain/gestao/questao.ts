export type Dificuldade = 'FACIL' | 'MEDIA' | 'DIFICIL';
export interface QuestaoEditavel { topicoId: string; dificuldade: Dificuldade; enunciado: string; alternativas: string[]; correta: string; justificativa?: string | null; fonte?: string | null; }
export type TipoEdicao = 'nenhuma' | 'metadados' | 'textual' | 'estrutural';
export const validarParaAtivar = (_q: QuestaoEditavel): string[] => { throw new Error('não implementado'); };
export const classificarEdicao = (_a: QuestaoEditavel, _d: QuestaoEditavel): TipoEdicao => { throw new Error('não implementado'); };
export const podeSalvarEdicao = (_t: TipoEdicao, _u: { usada: boolean }, _c: boolean) => { throw new Error('não implementado'); };
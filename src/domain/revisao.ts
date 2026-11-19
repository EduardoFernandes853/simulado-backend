export interface ItemRevisaoBase {
  questaoId: string;
  enunciado: string;
  disciplina: string;
  topico: string;
  correta: string;
  justificativa: string | null;
  alternativas: { letra: string; texto: string }[];
}
export interface ItemRevisao extends ItemRevisaoBase {
  escolhida: string | null;
  acertou: boolean;
}

export function montarRevisao(
  _itens: ItemRevisaoBase[],
  _respostas: { questaoId: string; alternativa: string }[],
): ItemRevisao[] {
  throw new Error('não implementado');
}
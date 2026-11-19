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
  itens: ItemRevisaoBase[],
  respostas: { questaoId: string; alternativa: string }[],
): ItemRevisao[] {
  const escolhidas = new Map(respostas.map((r): [string, string] => [r.questaoId, r.alternativa]));
  return itens.map((i) => {
    const escolhida = escolhidas.get(i.questaoId) ?? null;
    return { ...i, escolhida, acertou: escolhida === i.correta };
  });
}
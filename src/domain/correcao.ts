export interface ItemGabarito {
  questaoId: string;
  correta: string;
  disciplina: string;
  topico: string;
}

export interface RespostaAluno {
  questaoId: string;
  alternativa: string;
}

export interface ItemCorrigido {
  questaoId: string;
  escolhida: string | null;
  correta: boolean;
}

export interface DesempenhoTopico {
  disciplina: string;
  topico: string;
  acertos: number;
  total: number;
  percentual: number;
}

export interface ResultadoCorrecao {
  nota: number;
  acertos: number;
  total: number;
  itens: ItemCorrigido[];
  porTopico: DesempenhoTopico[];
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

export function corrigir(gabarito: ItemGabarito[], respostas: RespostaAluno[]): ResultadoCorrecao {
  if (gabarito.length === 0) throw new RangeError('O simulado não possui questões.');
  
  const escolhidas = new Map(
    respostas.map((r): [string, string] => [r.questaoId, r.alternativa.trim().toUpperCase()])
  );
  
  const itens: ItemCorrigido[] = gabarito.map((g) => {
    const escolhida = escolhidas.get(g.questaoId) ?? null;
    return { questaoId: g.questaoId, escolhida, correta: escolhida === g.correta.toUpperCase() };
  });
  
  const acertos = itens.filter((i) => i.correta).length;
  const total = gabarito.length;
  
  const grupos = new Map<string, DesempenhoTopico>();
  
  gabarito.forEach((g, idx) => {
    const chave = `${g.disciplina}::${g.topico}`;
    const atual = grupos.get(chave) ?? {
      disciplina: g.disciplina,
      topico: g.topico,
      acertos: 0,
      total: 0,
      percentual: 0,
    };
    atual.total += 1;
    if (itens[idx].correta) atual.acertos += 1;
    grupos.set(chave, atual);
  });
  
  const porTopico = [...grupos.values()].map((t) => ({
    ...t,
    percentual: arredondar((t.acertos / t.total) * 100),
  }));
  
  return { nota: arredondar((acertos / total) * 100), acertos, total, itens, porTopico };
}
export type Dificuldade = 'FACIL' | 'MEDIA' | 'DIFICIL';

export interface QuestaoEditavel {
  topicoId: string;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: string[]; // textos, na ordem A, B, C...
  correta: string; // letra
  justificativa?: string | null;
  fonte?: string | null;
}

export type TipoEdicao = 'nenhuma' | 'metadados' | 'textual' | 'estrutural';

export type ResultadoEdicao =
  | { ok: true; auditar: boolean }
  | { ok: false; codigo: 'CONFIRMACAO_NECESSARIA' | 'DUPLICAR'; motivo: string };

const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const textoNormalizado = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const opcional = (s: string | null | undefined) => (s ?? '').trim();

/** Lista de problemas que impedem ativar a questão. Vazia = pode ativar. */
export function validarParaAtivar(q: QuestaoEditavel): string[] {
  const problemas: string[] = [];
  if (q.enunciado.trim() === '') problemas.push('O enunciado está vazio.');

  const total = q.alternativas.length;
  if (total < 2 || total > 5) problemas.push('A questão precisa ter de 2 a 5 alternativas.');

  q.alternativas.slice(0, 5).forEach((texto, i) => {
    if (texto.trim() === '') problemas.push(`A alternativa ${LETRAS[i]} está vazia.`);
  });

  const textos = q.alternativas.filter((t) => t.trim() !== '').map(textoNormalizado);
  if (new Set(textos).size !== textos.length) problemas.push('Há alternativas com o mesmo texto.');

  const indice = LETRAS.indexOf(q.correta);
  if (indice === -1 || indice >= total) problemas.push('A alternativa correta não existe.');

  return problemas;
}

/**
 * estrutural: muda a letra correta ou o número de alternativas (altera o resultado de quem já respondeu);
 * textual: muda enunciado ou texto/ordem de alternativa (as respostas guardam só a LETRA);
 * metadados: justificativa, fonte, dificuldade, tópico.
 */
export function classificarEdicao(antes: QuestaoEditavel, depois: QuestaoEditavel): TipoEdicao {
  if (antes.correta !== depois.correta || antes.alternativas.length !== depois.alternativas.length) return 'estrutural';

  const textoMudou =
    antes.enunciado.trim() !== depois.enunciado.trim() ||
    antes.alternativas.some((t, i) => t.trim() !== depois.alternativas[i].trim());
  if (textoMudou) return 'textual';

  const metadadosMudaram =
    antes.topicoId !== depois.topicoId ||
    antes.dificuldade !== depois.dificuldade ||
    opcional(antes.justificativa) !== opcional(depois.justificativa) ||
    opcional(antes.fonte) !== opcional(depois.fonte);

  return metadadosMudaram ? 'metadados' : 'nenhuma';
}

export function podeSalvarEdicao(
  tipo: TipoEdicao,
  uso: { usada: boolean },
  confirmouCorrecaoEditorial: boolean,
): ResultadoEdicao {
  if (tipo === 'estrutural' && uso.usada) {
    return {
      ok: false,
      codigo: 'DUPLICAR',
      motivo: 'Esta questão já foi usada. Mudar a alternativa correta ou o número de alternativas alteraria resultados existentes: duplique a questão para editar.',
    };
  }
  if (tipo === 'textual' && uso.usada && !confirmouCorrecaoEditorial) {
    return {
      ok: false,
      codigo: 'CONFIRMACAO_NECESSARIA',
      motivo: 'Esta questão já foi usada. Confirme que é uma correção editorial que não muda o sentido das alternativas.',
    };
  }
  return { ok: true, auditar: tipo === 'textual' || tipo === 'estrutural' };
}
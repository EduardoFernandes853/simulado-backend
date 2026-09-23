import { corrigir } from './correcao';
import type { ItemGabarito } from './correcao';

const gabarito: ItemGabarito[] = [
  { questaoId: 'q1', correta: 'B', disciplina: 'Programação', topico: 'POO' },
  { questaoId: 'q2', correta: 'A', disciplina: 'Programação', topico: 'Estruturas de Dados' },
  { questaoId: 'q3', correta: 'C', disciplina: 'Matemática', topico: 'Álgebra' },
  { questaoId: 'q4', correta: 'D', disciplina: 'Matemática', topico: 'Álgebra' },
];

describe('corrigir', () => {
  it('gabarito completo → nota 100', () => {
    const r = corrigir(gabarito, [
      { questaoId: 'q1', alternativa: 'B' },
      { questaoId: 'q2', alternativa: 'A' },
      { questaoId: 'q3', alternativa: 'C' },
      { questaoId: 'q4', alternativa: 'D' },
    ]);
    expect(r.nota).toBe(100);
    expect(r.acertos).toBe(4);
  });

  it('nenhuma resposta → nota 0 (em branco conta como erro)', () => {
    const r = corrigir(gabarito, []);
    expect(r.nota).toBe(0);
    expect(r.itens.every((i) => i.escolhida === null)).toBe(true);
  });

  it('ignora maiúsculas/minúsculas e espaços', () => {
    const r = corrigir(gabarito, [{ questaoId: 'q1', alternativa: ' b ' }]);
    expect(r.acertos).toBe(1);
  });

  it('ignora respostas de questões que não pertencem ao simulado', () => {
    const r = corrigir(gabarito, [{ questaoId: 'outra', alternativa: 'A' }]);
    expect(r.acertos).toBe(0);
    expect(r.total).toBe(4);
  });

  it('arredonda a nota em 2 casas (1/3 → 33.33)', () => {
    const r = corrigir(gabarito.slice(0, 3), [{ questaoId: 'q1', alternativa: 'B' }]);
    expect(r.nota).toBe(33.33);
  });
  
  it('agrupa o desempenho por tópico', () => {
    const r = corrigir(gabarito, [
      { questaoId: 'q1', alternativa: 'B' },
      { questaoId: 'q2', alternativa: 'C' },
      { questaoId: 'q3', alternativa: 'C' },
      { questaoId: 'q4', alternativa: 'A' },
    ]);
    const t = (nome: string) => r.porTopico.find((x) => x.topico === nome);
    expect(t('POO')).toMatchObject({ acertos: 1, total: 1, percentual: 100 });
    expect(t('Estruturas de Dados')).toMatchObject({ acertos: 0, total: 1, percentual: 0 });
    expect(t('Álgebra')).toMatchObject({ acertos: 1, total: 2, percentual: 50 });
  });

  it('lança erro se o simulado não tem questões', () => {
    expect(() => corrigir([], [])).toThrow(RangeError);
  });
});
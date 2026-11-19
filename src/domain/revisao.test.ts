import { montarRevisao } from './revisao';

const base = [
  {
    questaoId: 'q1', enunciado: 'E1', disciplina: 'Redes', topico: 'Transporte', correta: 'A',
    justificativa: 'O TCP confirma a entrega.',
    alternativas: [{ letra: 'A', texto: 'TCP' }, { letra: 'B', texto: 'UDP' }],
  },
  {
    questaoId: 'q2', enunciado: 'E2', disciplina: 'Redes', topico: 'IP', correta: 'B',
    justificativa: null,
    alternativas: [{ letra: 'A', texto: 'x' }, { letra: 'B', texto: 'y' }],
  },
];

describe('montarRevisao', () => {
  it('marca acerto e deixa questão sem resposta como null', () => {
    const r = montarRevisao(base, [{ questaoId: 'q1', alternativa: 'A' }]);
    expect(r[0]).toMatchObject({ escolhida: 'A', acertou: true });
    expect(r[1]).toMatchObject({ escolhida: null, acertou: false });
  });

  it('marca erro quando escolhe outra alternativa', () => {
    expect(montarRevisao(base, [{ questaoId: 'q2', alternativa: 'A' }])[1].acertou).toBe(false);
  });

  it('preserva a ordem e a justificativa', () => {
    const r = montarRevisao(base, []);
    expect(r.map((x) => x.questaoId)).toEqual(['q1', 'q2']);
    expect(r[0].justificativa).toBe('O TCP confirma a entrega.');
    expect(r[1].justificativa).toBeNull();
  });

  it('ignora respostas de questões que não pertencem ao simulado', () => {
    const r = montarRevisao(base, [{ questaoId: 'outra', alternativa: 'A' }]);
    expect(r).toHaveLength(2);
    expect(r.every((x) => x.escolhida === null)).toBe(true);
  });
});
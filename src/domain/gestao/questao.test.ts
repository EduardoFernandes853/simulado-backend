import { classificarEdicao, podeSalvarEdicao, validarParaAtivar } from './questao';
import type { QuestaoEditavel, TipoEdicao } from './questao';

const base: QuestaoEditavel = {
  topicoId: 't1',
  dificuldade: 'MEDIA',
  enunciado: 'Qual protocolo é orientado a conexão?',
  alternativas: ['TCP', 'UDP', 'IP', 'ICMP'],
  correta: 'A',
  justificativa: 'O TCP confirma a entrega.',
  fonte: null,
};

const com = (extra: Partial<QuestaoEditavel>): QuestaoEditavel => ({ ...base, ...extra });

describe('validarParaAtivar', () => {
  it('aceita uma questão completa', () => expect(validarParaAtivar(base)).toEqual([]));

  it.each([
    ['enunciado vazio', com({ enunciado: '   ' }), 'O enunciado está vazio.'],
    ['uma só alternativa', com({ alternativas: ['TCP'] }), 'A questão precisa ter de 2 a 5 alternativas.'],
    ['seis alternativas', com({ alternativas: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'A questão precisa ter de 2 a 5 alternativas.'],
    ['alternativa vazia', com({ alternativas: ['TCP', ' ', 'IP'] }), 'A alternativa B está vazia.'],
    ['alternativas repetidas', com({ alternativas: ['TCP', ' tcp ', 'IP'] }), 'Há alternativas com o mesmo texto.'],
    ['correta fora do intervalo', com({ alternativas: ['TCP', 'UDP'], correta: 'C' }), 'A alternativa correta não existe.'],
    ['correta que não é letra de A a E', com({ correta: 'Z' }), 'A alternativa correta não existe.'],
  ])('recusa: %s', (_nome, questao, mensagem) => expect(validarParaAtivar(questao)).toContain(mensagem));

  it('junta todos os problemas, não só o primeiro', () => {
    expect(validarParaAtivar(com({ enunciado: '', alternativas: ['x'], correta: 'B' })).length).toBeGreaterThanOrEqual(3);
  });
});

describe('classificarEdicao', () => {
  it('sem mudança', () => expect(classificarEdicao(base, { ...base })).toBe('nenhuma'));

  it('espaços nas pontas não contam', () =>
    expect(classificarEdicao(base, com({ enunciado: `  ${base.enunciado}  ` }))).toBe('nenhuma'));

  it('null, undefined e vazio são a mesma fonte', () => {
    expect(classificarEdicao(com({ fonte: null }), com({ fonte: '' }))).toBe('nenhuma');
    expect(classificarEdicao(com({ fonte: null }), com({ fonte: undefined }))).toBe('nenhuma');
  });

  it.each([
    ['a justificativa', com({ justificativa: 'Outra.' })],
    ['a fonte', com({ fonte: 'ENADE 2021, questão 12' })],
    ['a dificuldade', com({ dificuldade: 'DIFICIL' })],
    ['o tópico', com({ topicoId: 't2' })],
  ])('mudar %s é metadados', (_nome, depois) => expect(classificarEdicao(base, depois)).toBe('metadados'));

  it.each([
    ['o enunciado', com({ enunciado: 'Qual protocolo é confiável?' })],
    ['o texto de uma alternativa', com({ alternativas: ['TCP', 'UDP', 'IPv4', 'ICMP'] })],
    ['a ordem das alternativas (muda o sentido das letras)', com({ alternativas: ['UDP', 'TCP', 'IP', 'ICMP'] })],
  ])('mudar %s é textual', (_nome, depois) => expect(classificarEdicao(base, depois)).toBe('textual'));

  it.each([
    ['a letra correta', com({ correta: 'B' })],
    ['o número de alternativas', com({ alternativas: ['TCP', 'UDP', 'IP'] })],
  ])('mudar %s é estrutural', (_nome, depois) => expect(classificarEdicao(base, depois)).toBe('estrutural'));

  it('estrutural vence textual, e textual vence metadados', () => {
    expect(classificarEdicao(base, com({ correta: 'B', enunciado: 'Outro?' }))).toBe('estrutural');
    expect(classificarEdicao(base, com({ enunciado: 'Outro?', fonte: 'x' }))).toBe('textual');
  });
});

describe('podeSalvarEdicao', () => {
  it.each([
    ['nenhuma', false, false, { ok: true, auditar: false }],
    ['metadados', false, false, { ok: true, auditar: false }],
    ['textual', false, false, { ok: true, auditar: true }],
    ['estrutural', false, false, { ok: true, auditar: true }],
    ['nenhuma', true, false, { ok: true, auditar: false }],
    ['metadados', true, false, { ok: true, auditar: false }],
    ['textual', true, true, { ok: true, auditar: true }],
  ])('%s, usada=%s, confirmou=%s', (tipo, usada, confirmou, esperado) => {
    expect(podeSalvarEdicao(tipo as TipoEdicao, { usada }, confirmou)).toEqual(esperado);
  });

  it('textual em questão usada, sem confirmação, pede a confirmação', () => {
    expect(podeSalvarEdicao('textual', { usada: true }, false)).toMatchObject({ ok: false, codigo: 'CONFIRMACAO_NECESSARIA' });
  });

  it.each([true, false])('estrutural em questão usada é bloqueada, mesmo com confirmação (%s)', (confirmou) => {
    expect(podeSalvarEdicao('estrutural', { usada: true }, confirmou)).toMatchObject({ ok: false, codigo: 'DUPLICAR' });
  });
});
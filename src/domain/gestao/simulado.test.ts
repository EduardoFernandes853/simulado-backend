import {
  calcularPrazo,
  camposNaoEditaveis,
  podeEditarComposicao,
  podeIniciarTentativa,
  revisaoLiberada,
  validarPublicacao,
} from './simulado';
import type { SimuladoRegras } from './simulado';

const em = (iso: string) => new Date(iso);
const AGORA = em('2026-12-01T12:00:00.000Z');

const publicado = (extra: Partial<SimuladoRegras> = {}): SimuladoRegras => ({
  status: 'PUBLICADO',
  duracaoMin: 60,
  abreEm: null,
  fechaEm: null,
  maxTentativas: null,
  revisao: 'IMEDIATA',
  ...extra,
});

describe('podeIniciarTentativa', () => {
  it('publicado, sem janela e sem limite', () => expect(podeIniciarTentativa(publicado(), AGORA, 0, false)).toEqual({ ok: true }));

  it.each([
    ['RASCUNHO', 'NAO_PUBLICADO'],
    ['ARQUIVADO', 'NAO_PUBLICADO'],
    ['ENCERRADO', 'ENCERRADO'],
  ])('status %s → %s', (status, codigo) => {
    expect(podeIniciarTentativa(publicado({ status: status as SimuladoRegras['status'] }), AGORA, 0, false)).toMatchObject({
      ok: false,
      codigo,
    });
  });

  it('não retoma tentativa de simulado que foi encerrado', () => {
    expect(podeIniciarTentativa(publicado({ status: 'ENCERRADO' }), AGORA, 0, true)).toMatchObject({ ok: false, codigo: 'ENCERRADO' });
  });

  it('retoma a tentativa aberta mesmo com o limite atingido', () => {
    expect(podeIniciarTentativa(publicado({ maxTentativas: 1 }), AGORA, 1, true)).toEqual({ ok: true });
  });

  it('abertura no futuro: ainda não abriu; no instante exato: abriu', () => {
    expect(podeIniciarTentativa(publicado({ abreEm: em('2026-12-01T12:00:00.001Z') }), AGORA, 0, false)).toMatchObject({
      ok: false,
      codigo: 'AINDA_NAO_ABRIU',
    });
    expect(podeIniciarTentativa(publicado({ abreEm: AGORA }), AGORA, 0, false)).toEqual({ ok: true });
  });

  it('fechamento no instante exato já está fechado; 1 ms depois ainda está aberto', () => {
    expect(podeIniciarTentativa(publicado({ fechaEm: AGORA }), AGORA, 0, false)).toMatchObject({ ok: false, codigo: 'ENCERRADO' });
    expect(podeIniciarTentativa(publicado({ fechaEm: em('2026-12-01T12:00:00.001Z') }), AGORA, 0, false)).toEqual({ ok: true });
  });

  it('limite de tentativas: a última ainda vale, a seguinte não', () => {
    expect(podeIniciarTentativa(publicado({ maxTentativas: 3 }), AGORA, 2, false)).toEqual({ ok: true });
    expect(podeIniciarTentativa(publicado({ maxTentativas: 3 }), AGORA, 3, false)).toMatchObject({
      ok: false,
      codigo: 'LIMITE_ATINGIDO',
    });
  });
});

describe('calcularPrazo', () => {
  it('sem fechamento: agora + duração', () => expect(calcularPrazo(AGORA, 60, null)).toEqual(em('2026-12-01T13:00:00.000Z')));

  it('fechamento antes do fim da duração: vale o fechamento', () =>
    expect(calcularPrazo(AGORA, 60, em('2026-12-01T12:30:00.000Z'))).toEqual(em('2026-12-01T12:30:00.000Z')));

  it('fechamento depois do fim da duração: vale a duração', () =>
    expect(calcularPrazo(AGORA, 60, em('2026-12-01T18:00:00.000Z'))).toEqual(em('2026-12-01T13:00:00.000Z')));

  it('fechamento exatamente no fim da duração', () =>
    expect(calcularPrazo(AGORA, 60, em('2026-12-01T13:00:00.000Z'))).toEqual(em('2026-12-01T13:00:00.000Z')));
});

describe('revisaoLiberada', () => {
  it('IMEDIATA: sempre', () => expect(revisaoLiberada(publicado({ revisao: 'IMEDIATA' }), AGORA)).toBe(true));

  it('NUNCA: nunca, nem encerrado', () => expect(revisaoLiberada(publicado({ revisao: 'NUNCA', status: 'ENCERRADO' }), AGORA)).toBe(false));

  it('APOS_ENCERRAMENTO: só depois do fechamento ou do encerramento manual', () => {
    const regra = (extra: Partial<SimuladoRegras>) => revisaoLiberada(publicado({ revisao: 'APOS_ENCERRAMENTO', ...extra }), AGORA);
    expect(regra({})).toBe(false);
    expect(regra({ fechaEm: em('2026-12-01T12:00:00.001Z') })).toBe(false);
    expect(regra({ fechaEm: AGORA })).toBe(true);
    expect(regra({ status: 'ENCERRADO' })).toBe(true);
    expect(regra({ status: 'ARQUIVADO' })).toBe(true);
  });
});

describe('edição do simulado', () => {
  it('a composição só muda em rascunho', () => {
    expect(podeEditarComposicao('RASCUNHO')).toBe(true);
    for (const s of ['PUBLICADO', 'ENCERRADO', 'ARQUIVADO'] as const) expect(podeEditarComposicao(s)).toBe(false);
  });

  it('rascunho aceita qualquer campo', () => {
    expect(camposNaoEditaveis('RASCUNHO', ['titulo', 'duracaoMin', 'questaoIds', 'maxTentativas'])).toEqual([]);
  });

  it('publicado trava duração, abertura, limite e composição, e libera título, descrição, fechamento e revisão', () => {
    expect(camposNaoEditaveis('PUBLICADO', ['titulo', 'descricao', 'fechaEm', 'revisao'])).toEqual([]);
    expect(camposNaoEditaveis('PUBLICADO', ['duracaoMin', 'abreEm', 'maxTentativas', 'questaoIds'])).toEqual([
      'duracaoMin',
      'abreEm',
      'maxTentativas',
      'questaoIds',
    ]);
  });

  it('encerrado só aceita título, descrição e revisão; arquivado, nada', () => {
    expect(camposNaoEditaveis('ENCERRADO', ['fechaEm'])).toEqual(['fechaEm']);
    expect(camposNaoEditaveis('ENCERRADO', ['titulo', 'revisao'])).toEqual([]);
    expect(camposNaoEditaveis('ARQUIVADO', ['titulo'])).toEqual(['titulo']);
  });
});

describe('validarPublicacao', () => {
  const ok = {
    duracaoMin: 60,
    abreEm: null,
    fechaEm: null,
    questoes: [
      { id: 'q1', status: 'ATIVA' as const },
      { id: 'q2', status: 'ATIVA' as const },
    ],
  };

  it('aceita um simulado completo', () => expect(validarPublicacao(ok, AGORA)).toEqual([]));

  it.each([
    ['sem questões', { ...ok, questoes: [] }, 'O simulado precisa ter ao menos uma questão.'],
    [
      'questão em rascunho',
      { ...ok, questoes: [{ id: 'q1', status: 'ATIVA' as const }, { id: 'q2', status: 'RASCUNHO' as const }] },
      'A questão 2 não está ativa (rascunho ou arquivada).',
    ],
    [
      'questão arquivada',
      { ...ok, questoes: [{ id: 'q1', status: 'ARQUIVADA' as const }] },
      'A questão 1 não está ativa (rascunho ou arquivada).',
    ],
    [
      'questão repetida',
      { ...ok, questoes: [{ id: 'q1', status: 'ATIVA' as const }, { id: 'q1', status: 'ATIVA' as const }] },
      'Há questões repetidas.',
    ],
    ['duração curta demais', { ...ok, duracaoMin: 4 }, 'A duração deve ficar entre 5 e 300 minutos.'],
    ['duração longa demais', { ...ok, duracaoMin: 301 }, 'A duração deve ficar entre 5 e 300 minutos.'],
    ['fechamento já passou', { ...ok, fechaEm: em('2026-12-01T11:00:00.000Z') }, 'O fechamento já passou.'],
    [
      'fechamento antes da abertura',
      { ...ok, abreEm: em('2026-12-02T10:00:00.000Z'), fechaEm: em('2026-12-02T09:00:00.000Z') },
      'O fechamento deve ser depois da abertura.',
    ],
  ])('recusa: %s', (_nome, dados, mensagem) => expect(validarPublicacao(dados, AGORA)).toContain(mensagem));
});
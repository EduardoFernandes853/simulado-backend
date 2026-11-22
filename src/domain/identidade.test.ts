import { DOMINIO_ALUNO, matriculaDoEmail } from '../contracts';
import { identificarPeloEmail } from './identidade';

describe('matriculaDoEmail', () => {
  it.each([
    ['20261234@aluno.ifpa.edu.br', '20261234'],
    ['  20261234@ALUNO.IFPA.EDU.BR ', '20261234'],
    ['00012345@aluno.ifpa.edu.br', '00012345'], // zeros à esquerda fazem parte da matrícula
  ])('aceita %p', (email, esperado) => expect(matriculaDoEmail(email)).toBe(esperado));

  it.each([
    ['', 'vazio'],
    ['20261234', 'sem @'],
    ['20261234@gmail.com', 'outro domínio'],
    ['20261234@ifpa.edu.br', 'domínio de servidores'],
    ['20261234@aluno.ifpa.edu.br.evil.com', 'sufixo malicioso'],
    ['20261234@evil.aluno.ifpa.edu.br', 'subdomínio'],
    ['20261234@xaluno.ifpa.edu.br', 'domínio parecido'],
    ['20261234@aluno.ifpa.edu.br.', 'ponto final'],
    ['20261234+turma@aluno.ifpa.edu.br', 'plus addressing (outra conta na mesma caixa)'],
    ['2026.1234@aluno.ifpa.edu.br', 'ponto na parte local'],
    ['abc12345@aluno.ifpa.edu.br', 'letras'],
    ['1234@aluno.ifpa.edu.br', 'curta demais'],
    ['1234567890123456@aluno.ifpa.edu.br', 'longa demais'],
    ['a@b@aluno.ifpa.edu.br', 'dois @'],
    ['\u0662\u0660\u0662\u0666\u0661\u0662\u0663\u0664@aluno.ifpa.edu.br', 'dígitos não ASCII'],
  ])('rejeita %p (%s)', (email) => expect(matriculaDoEmail(email)).toBeNull());

  it('respeita um domínio customizado', () => {
    expect(matriculaDoEmail('20261234@teste.local', 'teste.local')).toBe('20261234');
    expect(matriculaDoEmail('20261234@aluno.ifpa.edu.br', 'teste.local')).toBeNull();
  });
});

describe('identificarPeloEmail', () => {
  const politica = { dominioAluno: DOMINIO_ALUNO, emailsProfessores: ['ana.silva@ifpa.edu.br'] };

  it('aluno: a matrícula vem do e-mail', () => {
    expect(identificarPeloEmail('20261234@aluno.ifpa.edu.br', politica)).toEqual({ papel: 'ALUNO', matricula: '20261234' });
  });
  it('professor da lista: papel PROFESSOR e matrícula de servidor', () => {
    expect(identificarPeloEmail('ana.silva@ifpa.edu.br', politica)).toEqual({ papel: 'PROFESSOR', matricula: 'prof-ana.silva' });
  });
  it('a lista de professores ignora caixa e espaços', () => {
    expect(identificarPeloEmail('  Ana.Silva@IFPA.edu.br ', politica)?.papel).toBe('PROFESSOR');
  });
  it('e-mail de servidor que NÃO está na lista é recusado', () => {
    expect(identificarPeloEmail('outro@ifpa.edu.br', politica)).toBeNull();
  });
  it('e-mail fora de qualquer regra é recusado', () => {
    expect(identificarPeloEmail('fulano@gmail.com', politica)).toBeNull();
  });
  it('lista vazia: só alunos', () => {
    expect(identificarPeloEmail('ana.silva@ifpa.edu.br', { ...politica, emailsProfessores: [] })).toBeNull();
  });
});
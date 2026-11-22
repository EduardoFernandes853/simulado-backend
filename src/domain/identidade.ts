export interface PoliticaCadastro { dominioAluno: string; emailsProfessores: string[] }
export interface Identidade { papel: 'ALUNO' | 'PROFESSOR'; matricula: string }
export function identificarPeloEmail(_email: string, _politica: PoliticaCadastro): Identidade | null {
  throw new Error('não implementado');
}
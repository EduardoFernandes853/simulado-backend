import { matriculaDoEmail } from '../contracts';

export interface PoliticaCadastro {
  dominioAluno: string;
  emailsProfessores: string[];
}
export interface Identidade {
  papel: 'ALUNO' | 'PROFESSOR';
  matricula: string;
}

/** Decide quem pode abrir conta, e com qual papel e matrícula, SÓ a partir do e-mail já confirmado. */
export function identificarPeloEmail(email: string, politica: PoliticaCadastro): Identidade | null {
  const normalizado = email.trim().toLowerCase();
  const professores = politica.emailsProfessores.map((e) => e.trim().toLowerCase());
  if (professores.includes(normalizado)) {
    return { papel: 'PROFESSOR', matricula: `prof-${normalizado.split('@')[0]}` };
  }
  const matricula = matriculaDoEmail(normalizado, politica.dominioAluno);
  return matricula ? { papel: 'ALUNO', matricula } : null;
}
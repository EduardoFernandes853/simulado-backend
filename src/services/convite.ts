import { identificarPeloEmail } from '../domain/identidade';
import type { PoliticaCadastro } from '../domain/identidade';
import { ErroHttp } from '../middleware/erros';

export interface DepsConvite {
  buscarUsuario(email: string): Promise<{ id: string; confirmado: boolean } | null>;
  removerUsuario(id: string): Promise<void>;
  convidar(email: string, dados: { nome: string }): Promise<void>;
}

export type ResultadoConvite = 'enviado' | 'ja-cadastrado';

export async function solicitarConvite(
  entrada: { email: string; nome: string },
  politica: PoliticaCadastro,
  deps: DepsConvite,
): Promise<ResultadoConvite> {
  const email = entrada.email.trim().toLowerCase();
  if (!identificarPeloEmail(email, politica)) {
    throw new ErroHttp(422, `Use seu e-mail institucional (matrícula@${politica.dominioAluno}).`);
  }
  const existente = await deps.buscarUsuario(email);
  if (existente?.confirmado) return 'ja-cadastrado';
  if (existente) await deps.removerUsuario(existente.id); // pendente nunca teve acesso: pode recomeçar
  await deps.convidar(email, { nome: entrada.nome.trim() });
  return 'enviado';
}
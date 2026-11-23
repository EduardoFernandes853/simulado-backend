import type { PoliticaCadastro } from '../domain/identidade';

export interface DepsConvite {
  buscarUsuario(email: string): Promise<{ id: string; confirmado: boolean } | null>;
  removerUsuario(id: string): Promise<void>;
  convidar(email: string, dados: { nome: string }): Promise<void>;
}

export type ResultadoConvite = 'enviado' | 'ja-cadastrado';

export async function solicitarConvite(
  _entrada: { email: string; nome: string },
  _politica: PoliticaCadastro,
  _deps: DepsConvite,
): Promise<ResultadoConvite> {
  throw new Error('não implementado');
}
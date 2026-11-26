export const normalizarNome = (nome: string): string => nome.trim().replace(/\s+/g, ' ');

/** Mesma regra do índice único do banco (lower(nome)): dois nomes com a mesma chave são o mesmo nome. */
export const chaveDeNome = (nome: string): string => normalizarNome(nome).toLowerCase();
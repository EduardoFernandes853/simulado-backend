export function mascarar(_texto: string): string {
  throw new Error('não implementado');
}

export function urlSemSegredos(_url: string): string {
  throw new Error('não implementado');
}

export function limparEvento<T extends object>(_evento: T): T {
  throw new Error('não implementado');
}

export function limparEventoOuDescartar<T extends object>(_evento: T): T | null {
  throw new Error('não implementado');
}
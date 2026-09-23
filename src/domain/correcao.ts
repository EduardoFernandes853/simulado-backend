export interface ItemGabarito {
  questaoId: string;
  correta: string;
  disciplina: string;
  topico: string;
}
export function corrigir(_gabarito: any, _respostas: any): any {
  throw new Error('não implementado');
}
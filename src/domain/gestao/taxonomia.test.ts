import { chaveDeNome, normalizarNome } from './taxonomia';

describe('taxonomia', () => {
  it('normalizarNome apara e colapsa espaços, sem mexer em caixa nem acentos', () => {
    expect(normalizarNome('  Banco   de  Dados ')).toBe('Banco de Dados');
    expect(normalizarNome('Álgebra')).toBe('Álgebra');
  });

  it('chaveDeNome ignora a caixa: é a mesma regra do índice único do banco', () => {
    expect(chaveDeNome(' Banco  de Dados ')).toBe(chaveDeNome('banco de dados'));
    expect(chaveDeNome('Redes')).not.toBe(chaveDeNome('Rede'));
  });
});
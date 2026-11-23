import { DOMINIO_ALUNO } from '../contracts';
import { solicitarConvite } from './convite';
import type { DepsConvite } from './convite';

const politica = { dominioAluno: DOMINIO_ALUNO, emailsProfessores: ['ana.silva@ifpa.edu.br'] };
const EMAIL = `20261234@${DOMINIO_ALUNO}`;
const entrada = { email: EMAIL, nome: 'Maria Souza' };

function criarDeps(existente: { id: string; confirmado: boolean } | null = null) {
  const chamadas: string[] = [];
  const deps: DepsConvite = {
    buscarUsuario: jest.fn(async () => { chamadas.push('buscar'); return existente; }),
    removerUsuario: jest.fn(async () => { chamadas.push('remover'); }),
    convidar: jest.fn(async () => { chamadas.push('convidar'); }),
  };
  return { deps, chamadas };
}

describe('solicitarConvite', () => {
  it('e-mail novo: envia o convite', async () => {
    const { deps } = criarDeps(null);
    await expect(solicitarConvite(entrada, politica, deps)).resolves.toBe('enviado');
    expect(deps.convidar).toHaveBeenCalledWith(EMAIL, { nome: 'Maria Souza' });
    expect(deps.removerUsuario).not.toHaveBeenCalled();
  });

  it('já cadastrado e confirmado: não envia nada', async () => {
    const { deps } = criarDeps({ id: 'u1', confirmado: true });
    await expect(solicitarConvite(entrada, politica, deps)).resolves.toBe('ja-cadastrado');
    expect(deps.convidar).not.toHaveBeenCalled();
    expect(deps.removerUsuario).not.toHaveBeenCalled();
  });

  it('pendente (nunca confirmou): remove o registro antigo e convida de novo, nessa ordem', async () => {
    const { deps, chamadas } = criarDeps({ id: 'u2', confirmado: false });
    await expect(solicitarConvite(entrada, politica, deps)).resolves.toBe('enviado');
    expect(deps.removerUsuario).toHaveBeenCalledWith('u2');
    expect(chamadas).toEqual(['buscar', 'remover', 'convidar']);
  });

  it('normaliza o e-mail antes de consultar e convidar', async () => {
    const { deps } = criarDeps(null);
    await solicitarConvite({ email: `  ${EMAIL.toUpperCase()} `, nome: 'Maria Souza' }, politica, deps);
    expect(deps.buscarUsuario).toHaveBeenCalledWith(EMAIL);
    expect(deps.convidar).toHaveBeenCalledWith(EMAIL, expect.anything());
  });

  it('e-mail fora das regras: 422 e nenhuma chamada externa', async () => {
    const { deps } = criarDeps(null);
    await expect(solicitarConvite({ email: 'maria@gmail.com', nome: 'Maria Souza' }, politica, deps)).rejects.toMatchObject({ status: 422 });
    expect(deps.buscarUsuario).not.toHaveBeenCalled();
  });

  it('servidor da lista de professores também recebe convite', async () => {
    const { deps } = criarDeps(null);
    await expect(solicitarConvite({ email: 'ana.silva@ifpa.edu.br', nome: 'Ana Silva' }, politica, deps)).resolves.toBe('enviado');
  });

  it('se o convite falha depois de remover o pendente, o erro sobe', async () => {
    const { deps } = criarDeps({ id: 'u3', confirmado: false });
    (deps.convidar as unknown as jest.Mock).mockRejectedValue(new Error('smtp'));
    await expect(solicitarConvite(entrada, politica, deps)).rejects.toThrow('smtp');
  });
});
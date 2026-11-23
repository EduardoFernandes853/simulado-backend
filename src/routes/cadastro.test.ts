import request from 'supertest';
import { criarApp } from '../app';
import { ConviteRespostaSchema, DOMINIO_ALUNO } from '../contracts';
import { ErroHttp } from '../middleware/erros';
import { solicitarConvite } from '../services/convite';

jest.mock('../services/convite', () => ({ solicitarConvite: jest.fn() }));
jest.mock('../services/conviteSupabase', () => ({ depsSupabase: {} }));
jest.mock('../prisma', () => ({ prisma: {} }));

const solicitar = solicitarConvite as jest.Mock;
let contador = 0;
// e-mail novo a cada teste: o intervalo por e-mail fica guardado em memória
const novoEmail = () => `2026${String(++contador).padStart(4, '0')}@${DOMINIO_ALUNO}`;

beforeEach(() => jest.resetAllMocks());

describe('POST /cadastro', () => {
  it('202 com mensagem neutra, sem exigir login, e repassa dados normalizados', async () => {
    solicitar.mockResolvedValue('enviado');
    const email = novoEmail();
    const res = await request(criarApp()).post('/cadastro').send({ email: email.toUpperCase(), nome: '  Maria Souza ' });

    expect(res.status).toBe(202);
    expect(ConviteRespostaSchema.safeParse(res.body).success).toBe(true);
    expect(solicitar).toHaveBeenCalledWith(
      { email, nome: 'Maria Souza' },
      expect.objectContaining({ dominioAluno: DOMINIO_ALUNO }),
      expect.anything(),
    );
  });

  it('responde igual para "enviado" e "já cadastrado": não revela quem tem conta', async () => {
    solicitar.mockResolvedValueOnce('enviado').mockResolvedValueOnce('ja-cadastrado');
    const a = await request(criarApp()).post('/cadastro').send({ email: novoEmail(), nome: 'Maria Souza' });
    const b = await request(criarApp()).post('/cadastro').send({ email: novoEmail(), nome: 'Maria Souza' });

    expect(b.status).toBe(a.status);
    expect(b.body).toEqual(a.body);
  });

  it('repassa o 422 de e-mail fora das regras', async () => {
    solicitar.mockRejectedValue(new ErroHttp(422, 'Use seu e-mail institucional.'));
    const res = await request(criarApp()).post('/cadastro').send({ email: 'maria@gmail.com', nome: 'Maria Souza' });
    expect(res.status).toBe(422);
  });

  it.each([{ email: 'x@y.com' }, { nome: 'Maria Souza' }, { email: 'x@y.com', nome: 'ab' }])(
    '400 para corpo inválido %p',
    async (corpo) => {
      const res = await request(criarApp()).post('/cadastro').send(corpo);
      expect(res.status).toBe(400);
      expect(solicitar).not.toHaveBeenCalled();
    },
  );

  it('429 quando o mesmo e-mail pede de novo em menos de 1 minuto', async () => {
    solicitar.mockResolvedValue('enviado');
    const email = novoEmail();
    const app = criarApp();
    await request(app).post('/cadastro').send({ email, nome: 'Maria Souza' }).expect(202);
    const res = await request(app).post('/cadastro').send({ email, nome: 'Maria Souza' });

    expect(res.status).toBe(429);
    expect(solicitar).toHaveBeenCalledTimes(1);
  });
});
import request from 'supertest';
import { criarApp } from './app';

jest.mock('./prisma', () => ({ prisma: {} }));

describe('API sem autenticação', () => {
  const app = criarApp();

  it('GET /health responde 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it.each(['/me', '/simulados', '/tentativas/minhas', '/monitoria/alertas'])(
    'GET %s exige login (401)',
    async (rota) => {
      const res = await request(app).get(rota);
      expect(res.status).toBe(401);
      expect(res.body.erro).toBe('Token ausente.');
    },
  );
});
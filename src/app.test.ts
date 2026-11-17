import request from 'supertest';
import { criarApp } from './app';
import { config } from './config';

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

describe('limite global', () => {
  it('aplica limite por IP, mas /health não conta', async () => {
    const app = criarApp({ limiteIpPorMin: 2 });
    for (let i = 0; i < 5; i++) await request(app).get('/health').expect(200);
    await request(app).get('/nada').expect(404);
    await request(app).get('/nada').expect(404);
    await request(app).get('/nada').expect(429);
  });

  it('o 429 leva cabeçalhos CORS, senão o navegador mostra "erro de CORS" em vez da mensagem', async () => {
    const origem = config.CORS_ORIGINS.split(',')[0].trim();
    const app = criarApp({ limiteIpPorMin: 1 });
    await request(app).get('/nada').set('Origin', origem);
    const res = await request(app).get('/nada').set('Origin', origem);
    
    expect(res.status).toBe(429);
    expect(res.headers['access-control-allow-origin']).toBe(origem);
  });
});
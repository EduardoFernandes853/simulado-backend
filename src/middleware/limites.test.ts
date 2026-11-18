import express from 'express';
import request from 'supertest';
import { criarLimitePorIp, criarLimitePorUsuario } from './limites';

describe('limite por IP', () => {
  const montar = (limite: number) => {
    const app = express();
    app.use(criarLimitePorIp({ limite }));
    app.get('/x', (_req, res) => { res.json({ ok: true }); });
    return app;
  };

  it('permite até o limite e depois responde 429 em JSON', async () => {
    const app = montar(2);
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    const res = await request(app).get('/x');
    
    expect(res.status).toBe(429);
    expect(res.body.erro).toBe('Muitas requisições. Aguarde um instante.');
  });

  it('informa quando tentar de novo (Retry-After)', async () => {
    const app = montar(1);
    await request(app).get('/x');
    const res = await request(app).get('/x');
    
    expect(res.status).toBe(429);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('limite por usuário', () => {
  const montar = (limite: number) => {
    const app = express();
    app.use((req, _res, next) => { req.aluno = { id: String(req.headers['x-aluno']) } as never; next(); });
    app.post('/x', criarLimitePorUsuario({ limite }), (_req, res) => { res.json({ ok: true }); });
    return app;
  };

  it('conta por aluno, não por IP', async () => {
    const app = montar(1);
    await request(app).post('/x').set('x-aluno', 'ana').expect(200);
    await request(app).post('/x').set('x-aluno', 'ana').expect(429);
    await request(app).post('/x').set('x-aluno', 'beto').expect(200); // mesmo IP, outro aluno
  });
});
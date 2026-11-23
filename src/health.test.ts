import request from 'supertest';
import { criarApp } from './app';
import { prisma } from './prisma';

jest.mock('./prisma', () => ({ prisma: { simulado: { findFirst: jest.fn() } } }));
const db = prisma as unknown as { simulado: { findFirst: jest.Mock } };

beforeEach(() => jest.resetAllMocks());

describe('GET /health/db', () => {
  it('200 quando o banco responde, sem exigir login', async () => {
    db.simulado.findFirst.mockResolvedValue({ id: 'x' });
    const res = await request(criarApp()).get('/health/db');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', banco: 'ok' });
  });

  it('lê uma tabela de verdade (atividade real, não só a conexão)', async () => {
    db.simulado.findFirst.mockResolvedValue(null);
    await request(criarApp()).get('/health/db');
    expect(db.simulado.findFirst).toHaveBeenCalledTimes(1);
  });

  it('503 quando o banco falha, sem vazar o motivo', async () => {
    db.simulado.findFirst.mockRejectedValue(new Error('password authentication failed for user "postgres"'));
    const res = await request(criarApp()).get('/health/db');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degradado', banco: 'indisponivel' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|postgres/i);
  });

  it('conta no limite por IP, ao contrário do /health', async () => {
    db.simulado.findFirst.mockResolvedValue(null);
    const app = criarApp({ limiteIpPorMin: 1 });
    await request(app).get('/health/db').expect(200);
    await request(app).get('/health/db').expect(429);
    await request(app).get('/health').expect(200);
  });
});
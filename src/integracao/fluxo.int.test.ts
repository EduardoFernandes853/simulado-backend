import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { criarApp } from '../app';
import { prisma } from '../prisma';
import {
  DadosTitularSchema,
  HistoricoSchema,
  IniciarTentativaRespostaSchema,
  ListaAlertasSchema,
  ResultadoTentativaSchema,
  RevisaoSchema,
} from '../contracts';
import { depsSupabase } from '../services/conviteSupabase';
import { como, criarAluno, criarProfessor, criarSimuladoCompleto, desconectar, limparBanco } from './ajudas';

jest.mock('../middleware/auth', () => require('./authFalso'));
jest.mock('../services/conviteSupabase', () => ({
  depsSupabase: { removerUsuario: jest.fn(), buscarUsuario: jest.fn(), convidar: jest.fn() },
}));

beforeEach(async () => {
  await limparBanco();
  jest.clearAllMocks();
});

afterAll(desconectar);

async function provaFinalizada() {
  const aluno = await criarAluno({ authId: randomUUID() });
  const { simulado, questoes } = await criarSimuladoCompleto(3);
  const app = criarApp();

  const inicio = await request(app).post(`/simulados/${simulado.id}/tentativas`).set(como(aluno));
  expect(inicio.status).toBe(201);
  const prova = IniciarTentativaRespostaSchema.parse(inicio.body);
  expect(JSON.stringify(inicio.body)).not.toMatch(/gabarito|correta|justificativa/i);

  // acerta só a primeira: 1/3 = 33,33%, abaixo do limiar de 60
  const respostas = questoes.map((q, i) => ({ questaoId: q.id, alternativa: i === 0 ? 'A' : 'B' }));
  const fim = await request(app).post(`/tentativas/${prova.tentativaId}/finalizar`).set(como(aluno)).send({ respostas });

  return { app, aluno, simulado, questoes, prova, fim };
}

describe('fluxo completo da prova, contra o banco real', () => {
  it('inicia, finaliza, grava respostas e cria o alerta na mesma transação', async () => {
    const { fim } = await provaFinalizada();
    expect(fim.status).toBe(200);
    const resultado = ResultadoTentativaSchema.parse(fim.body);
    expect(resultado.nota).toBe(33.33);
    expect(resultado.alertaMonitoria).toBe(true);
    expect(await prisma.resposta.count()).toBe(3);
    expect(await prisma.alertaMonitoria.count()).toBe(1);
  });

  it('histórico, revisão e painel de monitoria cumprem os contratos', async () => {
    const { app, aluno, prova } = await provaFinalizada();
    const professor = await criarProfessor();

    const historico = await request(app).get('/tentativas/minhas').set(como(aluno));
    const lista = HistoricoSchema.parse(historico.body);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nota: 33.33, alertaMonitoria: true });

    const revisao = await request(app).get(`/tentativas/${prova.tentativaId}/revisao`).set(como(aluno));
    expect(revisao.status).toBe(200);
    const r = RevisaoSchema.parse(revisao.body);
    expect(r.questoes.map((q) => q.acertou)).toEqual([true, false, false]);
    expect(r.questoes[0].justificativa).toMatch(/correta/);

    const alertas = await request(app).get('/monitoria/alertas').set(como(professor));
    const a = ListaAlertasSchema.parse(alertas.body);
    expect(a).toHaveLength(1);
    expect(a[0].aluno.matricula).toBe(aluno.matricula);
  });

  it('aluno não acessa o painel de monitoria (403)', async () => {
    const { app, aluno } = await provaFinalizada();
    expect((await request(app).get('/monitoria/alertas').set(como(aluno))).status).toBe(403);
  });

  it('outro aluno não finaliza nem revisa a tentativa alheia (404) e finalizar duas vezes dá 409', async () => {
    const { app, aluno, prova } = await provaFinalizada();
    const intruso = await criarAluno();

    const finalizar = await request(app).post(`/tentativas/${prova.tentativaId}/finalizar`).set(como(intruso)).send({ respostas: [] });
    const revisar = await request(app).get(`/tentativas/${prova.tentativaId}/revisao`).set(como(intruso));
    const repetir = await request(app).post(`/tentativas/${prova.tentativaId}/finalizar`).set(como(aluno)).send({ respostas: [] });

    expect(finalizar.status).toBe(404);
    expect(revisar.status).toBe(404);
    expect(repetir.status).toBe(409);
  });
});

describe('direitos do titular, contra o banco real', () => {
  it('GET /me/dados traz tudo do aluno, cumpre o contrato e nunca o authId', async () => {
    const { app, aluno } = await provaFinalizada();
    const res = await request(app).get('/me/dados').set(como(aluno));
    expect(res.status).toBe(200);
    const dados = DadosTitularSchema.parse(res.body);
    expect(dados.tentativas).toHaveLength(1);
    expect(dados.tentativas[0].respostas).toHaveLength(3);
    expect(dados.alertas).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain(aluno.authId as string);
  });

  it('DELETE /me apaga o aluno e tudo o que depende dele, mantém o banco de questões e remove o login', async () => {
    const { app, aluno } = await provaFinalizada();
    const res = await request(app).delete('/me').set(como(aluno)).send({ confirmacao: 'EXCLUIR' });
    expect(res.status).toBe(204);
    expect(await prisma.aluno.count()).toBe(0);
    expect(await prisma.tentativa.count()).toBe(0);
    expect(await prisma.resposta.count()).toBe(0);
    expect(await prisma.alertaMonitoria.count()).toBe(0);
    expect(await prisma.questao.count()).toBe(3);
    expect(depsSupabase.removerUsuario).toHaveBeenCalledWith(aluno.authId);
  });

  it('professor não exclui a conta por esta rota', async () => {
    const professor = await criarProfessor({ authId: randomUUID() });
    const res = await request(criarApp()).delete('/me').set(como(professor)).send({ confirmacao: 'EXCLUIR' });
    expect(res.status).toBe(403);
    expect(await prisma.aluno.count()).toBe(1);
  });
});
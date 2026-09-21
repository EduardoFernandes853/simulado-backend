import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from './server';

// Mock do PrismaClient: impede que os testes toquem no banco de dados real (Supabase)
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    aluno: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

// Referência tipada para o TypeScript reconhecer os métodos do mock do Jest
const prisma = new PrismaClient() as unknown as {
  aluno: {
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
};

describe('Testes de Integração - CRUD de Alunos', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /alunos', () => {
    it('deve criar um novo aluno e retornar status 201', async () => {
      const payload = {
        matricula: '2026002',
        nome: 'João Silva',
        email: 'joao@teste.com',
      };
      const alunoCriado = { id: 'uuid-mock-1', ...payload };

      prisma.aluno.create.mockResolvedValue(alunoCriado);

      const response = await request(app).post('/alunos').send(payload);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(alunoCriado);
      expect(prisma.aluno.create).toHaveBeenCalledWith({ data: payload });
    });

    it('deve retornar status 500 se ocorrer um erro ao criar aluno', async () => {
      prisma.aluno.create.mockRejectedValue(new Error('Matrícula já existe'));

      const response = await request(app)
        .post('/alunos')
        .send({ matricula: '2026002', nome: 'João Silva', email: 'joao@teste.com' });

      expect(response.status).toBe(500);
      expect(response.body.erro).toBe('Erro interno no servidor.');
    });
  });

  describe('GET /alunos', () => {
    it('deve retornar a lista de alunos com status 200', async () => {
      const alunos = [
        { id: '1', matricula: '2026001', nome: 'Eduardo', email: 'eduardo@teste.com' },
        { id: '2', matricula: '2026002', nome: 'João', email: 'joao@teste.com' },
      ];
      prisma.aluno.findMany.mockResolvedValue(alunos);

      const response = await request(app).get('/alunos');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(alunos);
      expect(prisma.aluno.findMany).toHaveBeenCalledTimes(1);
    });

    it('deve retornar status 500 se falhar ao buscar alunos', async () => {
      prisma.aluno.findMany.mockRejectedValue(new Error('Falha no banco'));

      const response = await request(app).get('/alunos');

      expect(response.status).toBe(500);
      expect(response.body.erro).toBe('Erro ao buscar alunos.');
    });
  });

  describe('PUT /alunos/:id', () => {
    it('deve atualizar um aluno existente e retornar status 200', async () => {
      const alunoAtualizado = {
        id: 'uuid-1',
        matricula: '2026001',
        nome: 'Nome Atualizado',
        email: 'novoemail@teste.com',
      };
      prisma.aluno.update.mockResolvedValue(alunoAtualizado);

      const response = await request(app)
        .put('/alunos/uuid-1')
        .send({ nome: 'Nome Atualizado', email: 'novoemail@teste.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(alunoAtualizado);
      expect(prisma.aluno.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { nome: 'Nome Atualizado', email: 'novoemail@teste.com' },
      });
    });

    it('deve retornar status 500 se o aluno não existir para atualizar', async () => {
      prisma.aluno.update.mockRejectedValue(new Error('Aluno não encontrado'));

      const response = await request(app)
        .put('/alunos/id-falso')
        .send({ nome: 'Teste' });

      expect(response.status).toBe(500);
      expect(response.body.erro).toBe('Erro ao atualizar aluno.');
    });
  });

  describe('DELETE /alunos/:id', () => {
    it('deve deletar um aluno e retornar mensagem de sucesso', async () => {
      prisma.aluno.delete.mockResolvedValue({});

      const response = await request(app).delete('/alunos/uuid-1');

      expect(response.status).toBe(200);
      expect(response.body.mensagem).toBe('Aluno deletado com sucesso!');
      expect(prisma.aluno.delete).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
    });

    it('deve retornar status 500 se falhar ao deletar', async () => {
      prisma.aluno.delete.mockRejectedValue(new Error('Aluno não encontrado'));

      const response = await request(app).delete('/alunos/id-falso');

      expect(response.status).toBe(500);
      expect(response.body.erro).toBe('Erro ao deletar aluno.');
    });
  });
});
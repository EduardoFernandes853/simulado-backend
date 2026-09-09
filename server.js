const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// 1. CREATE (Cadastrar Aluno)
app.post('/alunos', async (req, res) => {
  try {
    const { matricula, nome, email } = req.body;
    if (!matricula || !nome || !email) {
      return res.status(400).json({ erro: "Matrícula, nome e e-mail são obrigatórios." });
    }
    const alunoExistente = await prisma.aluno.findUnique({ where: { matricula } });
    if (alunoExistente) {
      return res.status(400).json({ erro: "Já existe um aluno cadastrado com esta matrícula." });
    }
    const novoAluno = await prisma.aluno.create({
      data: { matricula, nome, email }
    });
    return res.status(201).json({ mensagem: "Aluno cadastrado com sucesso!", novoAluno });
  } catch (error) {
    return res.status(500).json({ erro: "Erro interno no servidor.", detalhe: error.message });
  }
});

// 2. READ (Listar Alunos)
app.get('/alunos', async (req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({
      include: {
        resultados: {
          include: { simulado: true }
        }
      }
    });
    return res.json(alunos);
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao buscar alunos.", detalhe: error.message });
  }
});

// 3. UPDATE (Atualizar Aluno)
app.put('/alunos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email } = req.body;
    const alunoExiste = await prisma.aluno.findUnique({ where: { id } });
    if (!alunoExiste) {
      return res.status(404).json({ erro: "Aluno não encontrado." });
    }
    const alunoAtualizado = await prisma.aluno.update({
      where: { id },
      data: { nome, email }
    });
    return res.json({ mensagem: "Aluno atualizado com sucesso!", alunoAtualizado });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao atualizar aluno.", detalhe: error.message });
  }
});

// 4. DELETE (Remover Aluno e seus resultados)
app.delete('/alunos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const alunoExiste = await prisma.aluno.findUnique({ where: { id } });
    if (!alunoExiste) {
      return res.status(404).json({ erro: "Aluno não encontrado." });
    }
    
    // Limpa os resultados vinculados primeiro para evitar conflito
    await prisma.resultado.deleteMany({
      where: { alunoId: id }
    });

    // Deleta o aluno
    await prisma.aluno.delete({
      where: { id }
    });

    return res.json({ mensagem: "Aluno e seus registros deletados com sucesso do sistema." });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao deletar aluno.", detalhe: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}! Acesse em http://localhost:3000`);
});
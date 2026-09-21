import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Rota para criar um aluno
app.post('/alunos', async (req: Request, res: Response) => {
  try {
    const { matricula, nome, email } = req.body;
    const novoAluno = await prisma.aluno.create({
      data: { matricula, nome, email },
    });
    res.status(201).json(novoAluno);
  } catch (error) {
    res.status(500).json({ erro: "Erro interno no servidor.", detalhe: (error as Error).message });
  }
});

// Rota para listar alunos
app.get('/alunos', async (req: Request, res: Response) => {
  try {
    const alunos = await prisma.aluno.findMany();
    res.json(alunos);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao buscar alunos.", detalhe: (error as Error).message });
  }
});

// Rota para atualizar um aluno
app.put('/alunos/:id', async (req: Request, res: Response) => {
  try {
    const { nome, email } = req.body;
    const alunoAtualizado = await prisma.aluno.update({
      where: { id: String(req.params.id) },
      data: { nome, email },
    });
    res.json(alunoAtualizado);
  } catch (error) {
    res.status(500).json({ erro: "Erro ao atualizar aluno.", detalhe: (error as Error).message });
  }
});

// Rota para deletar um aluno
app.delete('/alunos/:id', async (req: Request, res: Response) => {
  try {
    await prisma.aluno.delete({
      where: { id: String(req.params.id) },
    });
    res.json({ mensagem: "Aluno deletado com sucesso!" });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao deletar aluno.", detalhe: (error as Error).message });
  }
});


// Rota para registrar nota e disparar o Gatilho de Monitoria
app.post('/resultados', async (req: Request, res: Response) => {
  try {
    const { alunoId, simuladoId, nota } = req.body;

    // 1. Salva a nota no banco de dados
    const novoResultado = await prisma.resultado.create({
      data: {
        alunoId,
        simuladoId,
        nota,
      },
      // Puxa o nome do aluno junto para facilitar a exibição no front-end
      include: {
        aluno: {
          select: { nome: true, matricula: true }
        }
      }
    });

    // 2. A Inteligência: Gatilho de Monitoria
    // Convertendo o Decimal para Number para a verificação matemática
    const notaFinal = Number(novoResultado.nota);
    
    // Assumindo uma escala de 0 a 10 (60% = 6.0). Se for de 0 a 100, basta mudar para 60.
    const precisaMonitoria = notaFinal < 6.0; 

    // 3. Retorna o JSON completo para o layout do Pedro
    res.status(201).json({
      mensagem: "Nota registrada com sucesso!",
      resultado: novoResultado,
      diagnostico: {
        alertaMonitoria: precisaMonitoria,
        recomendacao: precisaMonitoria 
          ? "Atenção: Aluno com desempenho abaixo de 60%. Encaminhar para Monitoria de Pares." 
          : "Aproveitamento adequado. Nenhuma intervenção necessária."
      }
    });
  } catch (error) {
    res.status(500).json({ erro: "Erro ao registrar resultado.", detalhe: (error as Error).message });
  }
});

export default app;

// Só inicia o servidor na porta 3000 se não estiver rodando no ambiente de testes
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso na porta ${PORT}! Acesse em http://localhost:${PORT}`);
  });
}
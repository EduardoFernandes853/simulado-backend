import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando o cadastro de questões e simulado...");

  // 1. Cadastrando Questões no banco
  const q1 = await prisma.questao.create({
    data: {
      disciplina: "Informática",
      enunciado: "Qual princípio da Orientação a Objetos oculta os detalhes internos de uma classe?",
      gabarito: "Encapsulamento",
      nivelDificuldade: "Médio"
    }
  });

  const q2 = await prisma.questao.create({
    data: {
      disciplina: "Matemática",
      enunciado: "Qual é o valor de x na equação 2x + 10 = 20?",
      gabarito: "5",
      nivelDificuldade: "Fácil"
    }
  });

  const q3 = await prisma.questao.create({
    data: {
      disciplina: "Física",
      enunciado: "Qual é a unidade padrão de força no Sistema Internacional (SI)?",
      gabarito: "Newton",
      nivelDificuldade: "Fácil"
    }
  });

  console.log("Questões cadastradas com sucesso!");

  // 2. Criando o Simulado
  const simulado = await prisma.simulado.create({
    data: {
      titulo: "Simulado Diagnóstico - Setembro/2026"
    }
  });

  console.log(`Simulado criado: "${simulado.titulo}"`);

  // 3. Buscando o aluno que cadastramos anteriormente para registrar o resultado
  const aluno = await prisma.aluno.findUnique({
    where: { matricula: "2026001" }
  });

  if (aluno) {
    // 4. Registrando o Resultado do Aluno no Simulado
    const resultado = await prisma.resultado.create({
      data: {
        nota: 8.50,
        alunoId: aluno.id,
        simuladoId: simulado.id
      }
    });

    console.log("Resultado do aluno registrado com sucesso!");
    console.log(resultado);
  } else {
    console.log("Aluno não encontrado. Rode o index.js primeiro para cadastrar o aluno.");
  }
}

main()
  .catch((erro) => {
    console.error("Erro ao cadastrar dados:", erro);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
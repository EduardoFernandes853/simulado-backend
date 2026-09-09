const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Conectando ao banco de dados...");

  // Criando um novo aluno
  const novoAluno = await prisma.aluno.create({
    data: {
      matricula: "2026001",
      nome: "Eduardo Fernandes",
      email: "eduardo@teste.com"
    }
  });

  console.log("Sucesso! Aluno criado no Supabase:");
  console.log(novoAluno);
}

// Executa a função e depois desconecta
main()
  .catch((erro) => {
    console.error("Deu algum erro:", erro);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
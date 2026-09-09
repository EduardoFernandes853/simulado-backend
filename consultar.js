const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Buscando o boletim e dados relacionais do aluno...\n");

  // Busca o aluno e "puxa" junto todos os resultados e os simulados correspondentes
  const alunoComResultados = await prisma.aluno.findUnique({
    where: { matricula: "2026001" },
    include: {
      resultados: {
        include: {
          simulado: true // Traz os detalhes do simulado atrelado à nota
        }
      }
    }
  });

  if (!alunoComResultados) {
    console.log("Nenhum aluno encontrado com essa matrícula.");
    return;
  }

  console.log("==========================================");
  console.log(` ALUNO: ${alunoComResultados.nome}`);
  console.log(` MATRÍCULA: ${alunoComResultados.matricula}`);
  console.log(` E-MAIL: ${alunoComResultados.email}`);
  console.log("==========================================");
  console.log(" Histórico de Simulados Realizados:\n");

  alunoComResultados.resultados.forEach((res, index) => {
    console.log(` [${index + 1}] Simulado: ${res.simulado.titulo}`);
    console.log(`     Nota: ${res.nota}`);
    console.log(`     Realizado em: ${res.realizadoEm.toLocaleDateString()}`);
    console.log("------------------------------------------");
  });
}

main()
  .catch((erro) => {
    console.error("Erro na consulta:", erro);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
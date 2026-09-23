-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ALUNO', 'PROFESSOR');

-- CreateEnum
CREATE TYPE "Dificuldade" AS ENUM ('FACIL', 'MEDIA', 'DIFICIL');

-- CreateEnum
CREATE TYPE "StatusTentativa" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('PENDENTE', 'ATENDIDO');

-- CreateTable
CREATE TABLE "alunos" (
    "id" UUID NOT NULL,
    "auth_id" UUID,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'ALUNO',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alunos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplinas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "disciplinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topicos" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "disciplina_id" UUID NOT NULL,

    CONSTRAINT "topicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questoes" (
    "id" UUID NOT NULL,
    "enunciado" TEXT NOT NULL,
    "dificuldade" "Dificuldade" NOT NULL DEFAULT 'MEDIA',
    "topico_id" UUID NOT NULL,

    CONSTRAINT "questoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternativas" (
    "id" UUID NOT NULL,
    "questao_id" UUID NOT NULL,
    "letra" TEXT NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "alternativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gabaritos" (
    "questao_id" UUID NOT NULL,
    "alternativa_correta" TEXT NOT NULL,
    "justificativa" TEXT,

    CONSTRAINT "gabaritos_pkey" PRIMARY KEY ("questao_id")
);

-- CreateTable
CREATE TABLE "simulados" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "duracao_min" INTEGER NOT NULL DEFAULT 60,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulado_questoes" (
    "simulado_id" UUID NOT NULL,
    "questao_id" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "simulado_questoes_pkey" PRIMARY KEY ("simulado_id","questao_id")
);

-- CreateTable
CREATE TABLE "tentativas" (
    "id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "simulado_id" UUID NOT NULL,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prazo_em" TIMESTAMP(3) NOT NULL,
    "finalizada_em" TIMESTAMP(3),
    "nota" DECIMAL(5,2),
    "status" "StatusTentativa" NOT NULL DEFAULT 'EM_ANDAMENTO',

    CONSTRAINT "tentativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas" (
    "id" UUID NOT NULL,
    "tentativa_id" UUID NOT NULL,
    "questao_id" UUID NOT NULL,
    "alternativa" TEXT NOT NULL,
    "correta" BOOLEAN NOT NULL,

    CONSTRAINT "respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_monitoria" (
    "id" UUID NOT NULL,
    "tentativa_id" UUID NOT NULL,
    "aluno_id" UUID NOT NULL,
    "nota" DECIMAL(5,2) NOT NULL,
    "limiar" DECIMAL(5,2) NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendido_em" TIMESTAMP(3),

    CONSTRAINT "alertas_monitoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alunos_auth_id_key" ON "alunos"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_matricula_key" ON "alunos"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "alunos_email_key" ON "alunos"("email");

-- CreateIndex
CREATE UNIQUE INDEX "disciplinas_nome_key" ON "disciplinas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "topicos_disciplina_id_nome_key" ON "topicos"("disciplina_id", "nome");

-- CreateIndex
CREATE INDEX "questoes_topico_id_idx" ON "questoes"("topico_id");

-- CreateIndex
CREATE UNIQUE INDEX "alternativas_questao_id_letra_key" ON "alternativas"("questao_id", "letra");

-- CreateIndex
CREATE UNIQUE INDEX "simulado_questoes_simulado_id_ordem_key" ON "simulado_questoes"("simulado_id", "ordem");

-- CreateIndex
CREATE INDEX "tentativas_aluno_id_idx" ON "tentativas"("aluno_id");

-- CreateIndex
CREATE INDEX "tentativas_simulado_id_idx" ON "tentativas"("simulado_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_tentativa_id_questao_id_key" ON "respostas"("tentativa_id", "questao_id");

-- CreateIndex
CREATE UNIQUE INDEX "alertas_monitoria_tentativa_id_key" ON "alertas_monitoria"("tentativa_id");

-- CreateIndex
CREATE INDEX "alertas_monitoria_status_idx" ON "alertas_monitoria"("status");

-- AddForeignKey
ALTER TABLE "topicos" ADD CONSTRAINT "topicos_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questoes" ADD CONSTRAINT "questoes_topico_id_fkey" FOREIGN KEY ("topico_id") REFERENCES "topicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternativas" ADD CONSTRAINT "alternativas_questao_id_fkey" FOREIGN KEY ("questao_id") REFERENCES "questoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gabaritos" ADD CONSTRAINT "gabaritos_questao_id_fkey" FOREIGN KEY ("questao_id") REFERENCES "questoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulado_questoes" ADD CONSTRAINT "simulado_questoes_simulado_id_fkey" FOREIGN KEY ("simulado_id") REFERENCES "simulados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulado_questoes" ADD CONSTRAINT "simulado_questoes_questao_id_fkey" FOREIGN KEY ("questao_id") REFERENCES "questoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativas" ADD CONSTRAINT "tentativas_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativas" ADD CONSTRAINT "tentativas_simulado_id_fkey" FOREIGN KEY ("simulado_id") REFERENCES "simulados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_tentativa_id_fkey" FOREIGN KEY ("tentativa_id") REFERENCES "tentativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_questao_id_fkey" FOREIGN KEY ("questao_id") REFERENCES "questoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_monitoria" ADD CONSTRAINT "alertas_monitoria_tentativa_id_fkey" FOREIGN KEY ("tentativa_id") REFERENCES "tentativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas_monitoria" ADD CONSTRAINT "alertas_monitoria_aluno_id_fkey" FOREIGN KEY ("aluno_id") REFERENCES "alunos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de integridade que o Prisma não declara
ALTER TABLE "tentativas"        ADD CONSTRAINT "tentativas_nota_chk"    CHECK ("nota" IS NULL OR ("nota" >= 0 AND "nota" <= 100));
ALTER TABLE "alertas_monitoria" ADD CONSTRAINT "alertas_nota_chk"       CHECK ("nota" >= 0 AND "nota" <= 100);
ALTER TABLE "alternativas"      ADD CONSTRAINT "alternativas_letra_chk" CHECK ("letra" IN ('A','B','C','D','E'));
ALTER TABLE "gabaritos"         ADD CONSTRAINT "gabaritos_letra_chk"    CHECK ("alternativa_correta" IN ('A','B','C','D','E'));
ALTER TABLE "respostas"         ADD CONSTRAINT "respostas_letra_chk"    CHECK ("alternativa" IN ('A','B','C','D','E'));
ALTER TABLE "simulados"         ADD CONSTRAINT "simulados_duracao_chk"  CHECK ("duracao_min" > 0);
-- CreateEnum
CREATE TYPE "StatusQuestao" AS ENUM ('RASCUNHO', 'ATIVA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "StatusSimulado" AS ENUM ('RASCUNHO', 'PUBLICADO', 'ENCERRADO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "PoliticaRevisao" AS ENUM ('IMEDIATA', 'APOS_ENCERRAMENTO', 'NUNCA');

-- AlterTable
ALTER TABLE "questoes" ADD COLUMN     "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "atualizado_por_id" UUID,
ADD COLUMN     "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criado_por_id" UUID,
ADD COLUMN     "fonte" TEXT,
ADD COLUMN     "origem_id" UUID,
ADD COLUMN     "status" "StatusQuestao" NOT NULL DEFAULT 'ATIVA',
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "simulados" ADD COLUMN     "abre_em" TIMESTAMP(3),
ADD COLUMN     "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criado_por_id" UUID,
ADD COLUMN     "fecha_em" TIMESTAMP(3),
ADD COLUMN     "max_tentativas" INTEGER,
ADD COLUMN     "revisao" "PoliticaRevisao" NOT NULL DEFAULT 'IMEDIATA',
ADD COLUMN     "status" "StatusSimulado" NOT NULL DEFAULT 'RASCUNHO';

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "ator_id" UUID NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" UUID NOT NULL,
    "detalhe" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidade_id_idx" ON "auditoria"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "questoes_status_idx" ON "questoes"("status");

-- Preenche o status dos simulados existentes (a coluna "publicado" continua até a migração de contração)
UPDATE "simulados" SET "status" = CASE WHEN "publicado" THEN 'PUBLICADO'::"StatusSimulado" ELSE 'RASCUNHO'::"StatusSimulado" END;

ALTER TABLE "simulados" ADD CONSTRAINT "simulados_janela_chk"
  CHECK ("fecha_em" IS NULL OR "abre_em" IS NULL OR "fecha_em" > "abre_em");

ALTER TABLE "simulados" ADD CONSTRAINT "simulados_max_tent_chk"
  CHECK ("max_tentativas" IS NULL OR ("max_tentativas" BETWEEN 1 AND 20));

ALTER TABLE "questoes" ADD CONSTRAINT "questoes_versao_chk"
  CHECK ("versao" >= 1);

-- nomes de taxonomia únicos sem diferenciar maiúsculas
CREATE UNIQUE INDEX "disciplinas_nome_ci" ON "disciplinas" (lower("nome"));
CREATE UNIQUE INDEX "topicos_disciplina_nome_ci" ON "topicos" ("disciplina_id", lower("nome"));

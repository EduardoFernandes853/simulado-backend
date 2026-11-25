-- AlterTable
ALTER TABLE "alertas_monitoria" ADD COLUMN     "atendido_por_id" UUID;

-- AlterTable
ALTER TABLE "alunos" ADD COLUMN     "aviso_aceito_em" TIMESTAMP(3),
ADD COLUMN     "aviso_versao" TEXT;

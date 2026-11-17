-- CreateIndex
CREATE INDEX "alertas_monitoria_aluno_id_idx" ON "alertas_monitoria"("aluno_id");

-- CreateIndex
CREATE INDEX "respostas_questao_id_idx" ON "respostas"("questao_id");

-- CreateIndex
CREATE INDEX "simulado_questoes_questao_id_idx" ON "simulado_questoes"("questao_id");

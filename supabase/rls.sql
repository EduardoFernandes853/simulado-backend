-- 1) RLS ligada e acesso anônimo revogado em todas as tabelas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'alunos','disciplinas','topicos','questoes','alternativas','gabaritos',
    'simulados','simulado_questoes','tentativas','respostas','alertas_monitoria',
    '_prisma_migrations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- 2) Políticas de LEITURA para usuários autenticados (não há política de escrita:
--    toda escrita passa pelo backend). Sem política = negado (questões e gabaritos).
DROP POLICY IF EXISTS aluno_le_proprio_cadastro ON public.alunos;
CREATE POLICY aluno_le_proprio_cadastro ON public.alunos
  FOR SELECT TO authenticated
  USING (auth_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS aluno_le_proprias_tentativas ON public.tentativas;
CREATE POLICY aluno_le_proprias_tentativas ON public.tentativas
  FOR SELECT TO authenticated
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE auth_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS aluno_le_proprias_respostas ON public.respostas;
CREATE POLICY aluno_le_proprias_respostas ON public.respostas
  FOR SELECT TO authenticated
  USING (tentativa_id IN (
    SELECT t.id FROM public.tentativas t
    JOIN public.alunos a ON a.id = t.aluno_id
    WHERE a.auth_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS aluno_le_proprios_alertas ON public.alertas_monitoria;
CREATE POLICY aluno_le_proprios_alertas ON public.alertas_monitoria
  FOR SELECT TO authenticated
  USING (aluno_id IN (SELECT id FROM public.alunos WHERE auth_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS autenticado_le_simulados_publicados ON public.simulados;
CREATE POLICY autenticado_le_simulados_publicados ON public.simulados
  FOR SELECT TO authenticated
  USING (publicado = true);

-- 3) Conferência (tire print: rowsecurity deve ser true em todas)
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
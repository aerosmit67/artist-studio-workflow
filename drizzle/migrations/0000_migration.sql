CREATE TABLE public.studio_records (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  store text NOT NULL,
  id text NOT NULL,
  data jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_at bigint NOT NULL,
  PRIMARY KEY (user_id, store, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_records TO authenticated;
GRANT ALL ON public.studio_records TO service_role;
ALTER TABLE public.studio_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own records select" ON public.studio_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own records insert" ON public.studio_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own records update" ON public.studio_records FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own records delete" ON public.studio_records FOR DELETE TO authenticated USING (auth.uid() = user_id);
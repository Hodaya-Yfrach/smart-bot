CREATE TABLE public.chat_summaries (
  chat_id UUID PRIMARY KEY REFERENCES public.chats(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chat summaries" ON public.chat_summaries
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_summaries.chat_id
      AND chats.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = chat_summaries.chat_id
      AND chats.user_id = auth.uid()
  ));

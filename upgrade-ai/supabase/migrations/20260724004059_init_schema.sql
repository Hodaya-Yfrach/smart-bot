-- 1. יצירת טבלת פרופילים המקושרת למערכת האימות
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. יצירת טבלת צ'אטים (כל משתמש יכול לפתוח מספר שיחות)
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. יצירת טבלת הודעות (מקושרת לשיחה ספציפית)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL, -- 'user' או 'assistant' (התשובות של המודל)
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. טבלת חוקים אישיים (מיועדת לשמירת ההגדרות הספציפיות של כל משתמש)
CREATE TABLE IF NOT EXISTS public.user_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  system_instruction TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

---------------------------------------------------------
-- הגדרות אבטחה: Row Level Security (RLS)
-- זה מוודא שכל משתמש יכול לגשת אך ורק לנתונים שלו
---------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rules ENABLE ROW LEVEL SECURITY;

-- מדיניות לטבלת פרופילים: משתמש רואה ומעדכן רק את עצמו
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- מדיניות לטבלת צ'אטים: צפייה, יצירה ומחיקה רק של המשתמש עצמו
CREATE POLICY "Users can view own chats" ON public.chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON public.chats FOR DELETE USING (auth.uid() = user_id);

-- מדיניות לטבלת הודעות: משתמש רואה רק הודעות ששייכות לצ'אט שלו
CREATE POLICY "Users can view messages of their chats" ON public.messages FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

CREATE POLICY "Users can insert messages to their chats" ON public.messages FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()));

-- מדיניות לטבלת חוקים: צפייה ועריכה של משתמש את ההגדרות שלו
CREATE POLICY "Users can manage own rules" ON public.user_rules FOR ALL USING (auth.uid() = user_id);

---------------------------------------------------------
-- אוטומציה: יצירת פרופיל אוטומטית בעת הרשמה
---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
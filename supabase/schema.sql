-- ==============================================================================
-- CHORDED DATABASE SCHEMA & ROW LEVEL SECURITY (RLS)
-- Run this script in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Create Profiles Table (syncs with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  username_changes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Create Setlists Table
CREATE TABLE IF NOT EXISTS public.setlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  stage_preferences JSONB DEFAULT '{"nashville": false, "isDarkStage": true, "zoom": 1.0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on setlists
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;

-- Setlists RLS Policies
CREATE POLICY "Users can view their own setlists"
  ON public.setlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own setlists"
  ON public.setlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own setlists"
  ON public.setlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own setlists"
  ON public.setlists FOR DELETE
  USING (auth.uid() = user_id);


-- 3. Create Setlist Songs Table
CREATE TABLE IF NOT EXISTS public.setlist_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID REFERENCES public.setlists(id) ON DELETE CASCADE NOT NULL,
  song_index INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  original_key TEXT DEFAULT 'C',
  current_key TEXT DEFAULT 'C',
  bpm INTEGER,
  time_signature TEXT,
  content JSONB NOT NULL DEFAULT '{"type": "doc", "content": []}'::jsonb,
  raw_text TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast retrieval in setlist order
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_id_order 
  ON public.setlist_songs (setlist_id, song_index ASC);

-- Enable RLS on setlist_songs
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;

-- Setlist Songs RLS Policies (checks parent setlist user_id)
CREATE POLICY "Users can view songs in their own setlists"
  ON public.setlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.setlists 
      WHERE public.setlists.id = public.setlist_songs.setlist_id 
      AND public.setlists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert songs into their own setlists"
  ON public.setlist_songs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.setlists 
      WHERE public.setlists.id = public.setlist_songs.setlist_id 
      AND public.setlists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update songs in their own setlists"
  ON public.setlist_songs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.setlists 
      WHERE public.setlists.id = public.setlist_songs.setlist_id 
      AND public.setlists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete songs in their own setlists"
  ON public.setlist_songs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.setlists 
      WHERE public.setlists.id = public.setlist_songs.setlist_id 
      AND public.setlists.user_id = auth.uid()
    )
  );


-- 4. Create Library Songs Table (User Song Library)
CREATE TABLE IF NOT EXISTS public.library_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  original_key TEXT DEFAULT 'C',
  current_key TEXT DEFAULT 'C',
  bpm INTEGER,
  time_signature TEXT,
  content JSONB NOT NULL DEFAULT '{"type": "doc", "content": []}'::jsonb,
  raw_text TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user library lookup
CREATE INDEX IF NOT EXISTS idx_library_songs_user_id 
  ON public.library_songs (user_id, created_at DESC);

-- Enable RLS on library_songs
ALTER TABLE public.library_songs ENABLE ROW LEVEL SECURITY;

-- Library Songs RLS Policies
CREATE POLICY "Users can view their own library songs"
  ON public.library_songs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert songs into their own library"
  ON public.library_songs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update songs in their own library"
  ON public.library_songs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete songs from their own library"
  ON public.library_songs FOR DELETE
  USING (auth.uid() = user_id);


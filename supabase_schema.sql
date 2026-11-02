-- ==============================================================================
-- SUPABASE PRODUCTION DATABASE SCHEMA & ROW-LEVEL SECURITY (RLS) POLICIES
-- Project: Project Explainer (High-Scale Project & Data Files Support)
-- Supabase Project URL: https://wfuhdqldeetizzsvvyyo.supabase.co
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLES DEFINITIONS
-- ==============================================================================

-- PROFILES TABLE (Linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    gemini_api_key_configured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROJECTS TABLE (Repositories or folders uploaded/analyzed)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'folder' CHECK (source_type IN ('folder', 'git', 'zip')),
    source_url TEXT,
    loc INTEGER DEFAULT 0,
    files_count INTEGER DEFAULT 0,
    data_files_count INTEGER DEFAULT 0,
    languages JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROJECT SCANS TABLE (AST Analysis, Architecture Layers & Diagrams)
CREATE TABLE IF NOT EXISTS public.project_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT,
    architecture_layers JSONB DEFAULT '{}'::jsonb,
    diagrams JSONB DEFAULT '{}'::jsonb,
    high_coupling_modules JSONB DEFAULT '[]'::jsonb,
    circular_dependencies JSONB DEFAULT '[]'::jsonb,
    ast_file_manifest JSONB DEFAULT '[]'::jsonb,
    scan_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- PROJECT FILES TABLE (Stores Code and Data Files for 1,000+ File Scale)
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    extension TEXT,
    file_category TEXT NOT NULL DEFAULT 'code' CHECK (file_category IN ('code', 'data', 'config', 'document', 'asset', 'schema')),
    language TEXT,
    size_bytes BIGINT DEFAULT 0,
    loc INTEGER DEFAULT 0,
    content TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CHAT HISTORY TABLE (Conversational Repository Q&A Sessions)
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    message TEXT NOT NULL,
    active_file TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-THROUGHPUT & BULK SCALE (1000+ FILES)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_scans_project_id ON public.project_scans(project_id);
CREATE INDEX IF NOT EXISTS idx_project_scans_user_id ON public.project_scans(user_id);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_user_id ON public.project_files(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_category ON public.project_files(file_category);
CREATE INDEX IF NOT EXISTS idx_project_files_extension ON public.project_files(extension);
CREATE INDEX IF NOT EXISTS idx_project_files_path ON public.project_files(project_id, file_path);

CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON public.chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON public.chat_history(created_at ASC);

-- ==============================================================================
-- 4. ROW-LEVEL SECURITY (RLS) ACTIVATION
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. RLS POLICIES (Strict Principle of Least Privilege)
-- ==============================================================================

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
 
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- PROJECTS POLICIES
DROP POLICY IF EXISTS "Users can view own or public projects" ON public.projects;
CREATE POLICY "Users can view own or public projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects"
    ON public.projects FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- PROJECT SCANS POLICIES
DROP POLICY IF EXISTS "Users can view own project scans" ON public.project_scans;
CREATE POLICY "Users can view own project scans"
    ON public.project_scans FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own project scans" ON public.project_scans;
CREATE POLICY "Users can insert own project scans"
    ON public.project_scans FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own project scans" ON public.project_scans;
CREATE POLICY "Users can delete own project scans"
    ON public.project_scans FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- PROJECT FILES POLICIES (Bulk inserts & queries for thousands of files)
DROP POLICY IF EXISTS "Users can view own project files" ON public.project_files;
CREATE POLICY "Users can view own project files"
    ON public.project_files FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own project files" ON public.project_files;
CREATE POLICY "Users can insert own project files"
    ON public.project_files FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own project files" ON public.project_files;
CREATE POLICY "Users can update own project files"
    ON public.project_files FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own project files" ON public.project_files;
CREATE POLICY "Users can delete own project files"
    ON public.project_files FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- CHAT HISTORY POLICIES
DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_history;
CREATE POLICY "Users can view own chat messages"
    ON public.chat_history FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat messages" ON public.chat_history;
CREATE POLICY "Users can insert own chat messages"
    ON public.chat_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat messages" ON public.chat_history;
CREATE POLICY "Users can delete own chat messages"
    ON public.chat_history FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. AUTOMATED TRIGGERS & FUNCTIONS
-- ==============================================================================

-- A. Auto-handle updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- B. Automatically create profile row when user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET CONFIGURATION (For Raw Project & Data Files)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload project files to storage" ON storage.objects;
CREATE POLICY "Users can upload project files to storage"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own project files from storage" ON storage.objects;
CREATE POLICY "Users can read own project files from storage"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Phase 2: Community Projects (user-uploaded, separate from AI `creations`)
-- Run this in the Supabase dashboard → SQL Editor.
-- Files are stored in the existing public `models` storage bucket under
-- the `projects/` prefix, so no new bucket setup is required.

-- ── projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL DEFAULT '',
  description       text NOT NULL DEFAULT '',        -- rich HTML
  category          text,
  is_original       boolean NOT NULL DEFAULT true,   -- false = remix / derived work
  remix_source      text,                            -- optional URL / attribution when remix
  license_adapt     text NOT NULL DEFAULT 'yes',     -- 'yes' | 'no' (ND) | 'sa'
  license_commercial boolean NOT NULL DEFAULT true,  -- allow commercial use
  post_process      text,                            -- optional finishing notes
  pictures          text[] NOT NULL DEFAULT '{}',    -- ordered image URLs
  tags              text[] NOT NULL DEFAULT '{}',
  machines          text[] NOT NULL DEFAULT '{}',    -- e.g. Carvera, Carvera Air
  materials         text[] NOT NULL DEFAULT '{}',    -- e.g. Wood, Aluminum
  status            text NOT NULL DEFAULT 'draft',   -- 'draft' | 'published'
  download_count    integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz
);

CREATE INDEX IF NOT EXISTS projects_status_published_idx
  ON projects (status, published_at DESC);
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_category_idx ON projects (category);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Anyone can read published projects; owners can read their own (incl. drafts)
CREATE POLICY "projects_select_published" ON projects
  FOR SELECT USING (status = 'published' OR auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- ── project_files ─────────────────────────────────────────────────────────────
-- One row per uploaded file. `kind` groups them in the UI.
CREATE TABLE IF NOT EXISTS project_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        text NOT NULL,                 -- 'nc' | 'cam' | 'model' | 'attachment'
  name        text NOT NULL,
  url         text NOT NULL,                 -- public download URL
  path        text NOT NULL,                 -- storage path (for deletes)
  size_bytes  bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_files_project_idx ON project_files (project_id);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- Files are visible when the parent project is visible to the caller
CREATE POLICY "project_files_select" ON project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
        AND (p.status = 'published' OR p.user_id = auth.uid())
    )
  );

CREATE POLICY "project_files_insert_own" ON project_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

CREATE POLICY "project_files_delete_own" ON project_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  );

-- ── project_likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_likes (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE project_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_likes_select" ON project_likes FOR SELECT USING (true);
CREATE POLICY "project_likes_insert" ON project_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_likes_delete" ON project_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ── project_saves (bookmarks) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_saves (
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE project_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_saves_select" ON project_saves
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "project_saves_insert" ON project_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "project_saves_delete" ON project_saves
  FOR DELETE USING (auth.uid() = user_id);

-- ── download counter ──────────────────────────────────────────────────────────
-- SECURITY DEFINER so anonymous visitors can bump the counter without being
-- able to write arbitrary values to the row.
CREATE OR REPLACE FUNCTION increment_project_download(pid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE projects SET download_count = download_count + 1 WHERE id = pid;
$$;

GRANT EXECUTE ON FUNCTION increment_project_download(uuid) TO anon, authenticated;

-- ── keep updated_at fresh ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_projects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_touch_updated_at ON projects;
CREATE TRIGGER projects_touch_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION touch_projects_updated_at();

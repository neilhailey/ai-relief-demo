-- Phase 1: Likes and Saves tables
-- Run this in the Supabase dashboard → SQL Editor

-- ── Likes ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creation_likes (
  creation_id uuid NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (creation_id, user_id)
);

ALTER TABLE creation_likes ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read like counts
CREATE POLICY "creation_likes_select" ON creation_likes
  FOR SELECT USING (true);

-- Authenticated users can like
CREATE POLICY "creation_likes_insert" ON creation_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only unlike their own likes
CREATE POLICY "creation_likes_delete" ON creation_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ── Saves / Bookmarks ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creation_saves (
  creation_id uuid NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (creation_id, user_id)
);

ALTER TABLE creation_saves ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own saves
CREATE POLICY "creation_saves_select" ON creation_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "creation_saves_insert" ON creation_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "creation_saves_delete" ON creation_saves
  FOR DELETE USING (auth.uid() = user_id);

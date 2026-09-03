-- Runtime settings the admin console can change.
--
-- The AI provider configuration used to live in a JSON file next to the
-- source (`backend/src/ai_config.json`, gitignored). That file does not
-- survive a redeploy: the container is rebuilt, the file is gone, and
-- `loadAIConfig` quietly falls back to the AI_API_KEY in the environment —
-- which is the old key the admin had just replaced. From the console it
-- looked saved; from a user's seat MaxAI was still broken. Two instances
-- would not have shared it either.
--
-- A row in the database is shared, survives a deploy, and is the same
-- answer for every instance.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Who changed it last. Not a foreign key: deleting an account must not
    -- erase the record of what it configured.
    updated_by UUID,
    updated_by_username VARCHAR(30)
);

-- This table holds provider credentials, so it must never be readable by
-- the anon or authenticated roles. Only the service key — which is what the
-- backend uses — may touch it. RLS with no policy denies everyone else.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

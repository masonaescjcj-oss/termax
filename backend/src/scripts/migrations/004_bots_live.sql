-- Live deployment for bots: a bot that has COMPLETED a forward test can be
-- promoted to LIVE on a real cTrader account. The gate (minimum days +
-- minimum trades, configurable) is enforced in the API; this migration only
-- gives the schema the vocabulary.
-- Safe to run more than once.

ALTER TABLE public.bots DROP CONSTRAINT IF EXISTS bots_status_check;
ALTER TABLE public.bots ADD CONSTRAINT bots_status_check
    CHECK (status IN ('STOPPED', 'FORWARD_TEST', 'LIVE'));

-- 'MIN' = every live order goes out at the instrument's minimum volume,
-- whatever the spec says — the roadmap's default for a fresh live bot.
-- 'SPEC' = trust the spec's sizing (requires an explicit user choice).
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS live_volume_mode VARCHAR(10)
    NOT NULL DEFAULT 'MIN' CHECK (live_volume_mode IN ('MIN', 'SPEC'));

ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;

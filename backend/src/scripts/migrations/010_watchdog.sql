-- Bot watchdog: per-bot safety limits that can only ever STOP a bot,
-- never open a trade. Stored per bot so each strategy carries its own
-- risk appetite, with an explicit on/off switch.
--
-- bot_events: the audit trail — why did my bot stop? Every trip is
-- recorded with the numbers that caused it.
-- Safe to run more than once.

ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS watchdog JSONB
    NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.bot_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    kind VARCHAR(24) NOT NULL,
    severity VARCHAR(10) NOT NULL DEFAULT 'WARN' CHECK (severity IN ('INFO', 'WARN', 'ALERT')),
    message_fa TEXT NOT NULL,
    message_en TEXT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bot_events_bot ON public.bot_events (bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_events_user ON public.bot_events (user_id, created_at DESC);

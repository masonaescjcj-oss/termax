-- Phase 10: plans + the published-strategy library.
--
-- users.plan: FREE / PRO. Enforcement lives in services/plans.ts — one
-- table of limits, read everywhere a cap is checked.
--
-- published_strategies: a bot published to the library. The HARD RULE is
-- enforced in the API: only a bot whose FORWARD TEST passes the gate
-- thresholds can be published, and the record shown is always the live
-- forward record — never a backtest.
-- Safe to run more than once.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan VARCHAR(10)
    NOT NULL DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO'));

CREATE TABLE IF NOT EXISTS public.published_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    title VARCHAR(60) NOT NULL,
    description VARCHAR(500),
    -- Frozen copy of the spec at publish time (cloning uses this, so a
    -- later edit to the author's bot cannot silently change what others
    -- cloned).
    spec JSONB NOT NULL,
    clones INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bot_id)
);

CREATE INDEX IF NOT EXISTS idx_published_strategies_active
    ON public.published_strategies (is_active, published_at DESC);

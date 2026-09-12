-- Daily account history: one row per account per UTC day.
--
-- Equity is a moving number; the app could only ever show the trader what
-- it was *right now*. These rows are what make a growth curve, a drawdown
-- and a monthly return possible at all — none of which can be
-- reconstructed after the fact from closed trades alone, because floating
-- P/L and deposits do not appear in them.
--
-- The unique index makes the daily job an upsert: running it twice, or
-- backfilling a missed day, corrects the row instead of duplicating it.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.account_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id VARCHAR(64) NOT NULL,
    -- UTC calendar day this snapshot describes.
    day DATE NOT NULL,
    balance NUMERIC(20, 2) NOT NULL DEFAULT 0,
    equity NUMERIC(20, 2) NOT NULL DEFAULT 0,
    margin NUMERIC(20, 2) NOT NULL DEFAULT 0,
    open_positions INTEGER NOT NULL DEFAULT 0,
    -- Realised on that day, and how many trades made it.
    realised NUMERIC(20, 2) NOT NULL DEFAULT 0,
    trades INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_snapshots_one
    ON public.account_snapshots (user_id, account_id, day);
CREATE INDEX IF NOT EXISTS idx_account_snapshots_user
    ON public.account_snapshots (user_id, day DESC);

ALTER TABLE public.account_snapshots ENABLE ROW LEVEL SECURITY;

-- Backtests: a strategy spec run over stored history, with its result and
-- honesty grade. The full result (trades, equity curve) lives in `result`;
-- `summary` holds just what the list screen needs, so listing 50 backtests
-- does not ship megabytes of trades.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.backtests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- Optional link back to a saved bot; the spec is still copied in full so
    -- the result stays interpretable after the bot is edited or deleted.
    bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL,
    name VARCHAR(60) NOT NULL,
    spec JSONB NOT NULL,
    from_ts TIMESTAMPTZ NOT NULL,
    to_ts TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'DONE', 'FAILED')),
    -- Small: stats + honesty grade + warnings.
    summary JSONB,
    -- Large: trades + equity curve + full honesty checks.
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backtests_user_created
    ON public.backtests (user_id, created_at DESC);

-- Phase 5: the AI layer's two counters.
--
-- ai_usage: per-user, per-day message counter — the quota that keeps the AI
-- bill (the real cost on a $25 server) bounded. One row per user per day.
--
-- trade_stats_daily: the trade-stats rollup. Updated when a trade CLOSES,
-- so "how am I doing this month?" reads 30 tiny rows instead of aggregating
-- the user's whole position history on every question.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.ai_usage (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS public.trade_stats_daily (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id VARCHAR(100) NOT NULL,
    day DATE NOT NULL,
    trades INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    gross_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
    gross_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
    net_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, account_id, day)
);

CREATE INDEX IF NOT EXISTS idx_trade_stats_daily_user_day
    ON public.trade_stats_daily (user_id, day DESC);

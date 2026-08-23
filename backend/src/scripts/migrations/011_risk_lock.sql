-- Account-level risk guard: the human trader's own daily loss limit.
-- The bot watchdog protects bots; this protects the person. When the
-- limit is hit the account is locked until the next UTC day — new orders
-- are refused, open positions keep their stops.
--
-- Also: the backtest result cache key, so the same spec over the same
-- window returns the stored answer instead of burning the worker pool.
-- Safe to run more than once.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS risk_guard JSONB
    NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.backtests ADD COLUMN IF NOT EXISTS cache_key VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_backtests_cache
    ON public.backtests (user_id, cache_key) WHERE cache_key IS NOT NULL;

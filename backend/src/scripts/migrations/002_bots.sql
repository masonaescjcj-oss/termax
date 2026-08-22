-- Bots: a user's saved strategies and their run state.
-- A bot is a declarative StrategySpec (JSON) interpreted by the shared
-- engine; it is data, not code — see docs/ai-architecture.md §1.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- The (simulated) account the bot trades on.
    account_id VARCHAR(100) NOT NULL,
    name VARCHAR(60) NOT NULL,
    -- The validated StrategySpec document.
    spec JSONB NOT NULL,
    -- FORWARD_TEST is the only mode that can trade until the live gate ships.
    status VARCHAR(20) NOT NULL DEFAULT 'STOPPED'
        CHECK (status IN ('STOPPED', 'FORWARD_TEST')),
    -- Interpreter BotState (day counters, cooldown), persisted so a restart
    -- resumes counters instead of resetting daily limits.
    run_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Forward-test bookkeeping.
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bots_user ON public.bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON public.bots(status);

-- Positions opened by a bot carry its id, so its record and P/L are queryable.
ALTER TABLE public.positions
    ADD COLUMN IF NOT EXISTS bot_id UUID REFERENCES public.bots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_positions_bot ON public.positions(bot_id)
    WHERE bot_id IS NOT NULL;

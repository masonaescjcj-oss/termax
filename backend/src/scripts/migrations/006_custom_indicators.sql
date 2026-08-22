-- Custom indicators: safe arithmetic expressions over candle streams,
-- validated by the expression compiler before they are ever stored.
-- The QuickJS code tier (paid) is a separate, later story.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.custom_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    expr VARCHAR(400) NOT NULL,
    -- 'price' draws on the candle pane; 'separate' gets its own pane.
    pane VARCHAR(10) NOT NULL DEFAULT 'separate' CHECK (pane IN ('price', 'separate')),
    color VARCHAR(20) NOT NULL DEFAULT '#F5A623',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_indicators_user
    ON public.custom_indicators (user_id, enabled);

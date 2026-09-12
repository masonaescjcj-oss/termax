-- Server-side alerts and the notification inbox.
--
-- Until now a price alert lived only in the browser tab that created it,
-- so it died when the tab closed. These rows are checked on the server
-- against the live feed and delivered wherever the trader is: the in-app
-- inbox (this table), the open terminal (socket), Telegram (the bot the
-- app already runs) and, when a device registers one, a push token.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.price_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    symbol VARCHAR(32) NOT NULL,
    price NUMERIC(20, 8) NOT NULL,
    -- 'above' fires when the mid reaches or exceeds price; 'below' the reverse.
    condition VARCHAR(8) NOT NULL CHECK (condition IN ('above', 'below')),
    note TEXT,
    status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
    triggered_at TIMESTAMPTZ,
    triggered_price NUMERIC(20, 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON public.price_alerts (symbol) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON public.price_alerts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    -- price_alert | position | margin | bot | system
    kind VARCHAR(24) NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.push_tokens (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(12) NOT NULL DEFAULT 'expo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, token)
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

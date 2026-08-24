-- Trade journal notes: the human half of the journal. Everything else in
-- the journal is measured; this table is the only place the trader's own
-- words live. One note per trade per user, so saving is an upsert and a
-- second save edits rather than duplicates.
--
-- Emotion is deliberately a short closed list, not free text: a list can
-- be sliced ("your greedy trades lose $1,240"), a paragraph cannot.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.trade_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
    note TEXT NOT NULL DEFAULT '',
    emotion VARCHAR(16),
    -- The trader's own labels, alongside the engine's computed ones.
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_notes_one
    ON public.trade_notes (user_id, position_id);
CREATE INDEX IF NOT EXISTS idx_trade_notes_user
    ON public.trade_notes (user_id, updated_at DESC);

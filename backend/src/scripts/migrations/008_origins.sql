-- Where did this thing come from? USER (built by hand), AI (built by
-- MaxAI / the builder), IMPORT (brought in from a file), CLONE (from the
-- library). Powers the AI Studio's categorised history.
-- Safe to run more than once.

ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS origin VARCHAR(10)
    NOT NULL DEFAULT 'USER' CHECK (origin IN ('USER', 'AI', 'IMPORT', 'CLONE'));

ALTER TABLE public.custom_indicators ADD COLUMN IF NOT EXISTS origin VARCHAR(10)
    NOT NULL DEFAULT 'USER' CHECK (origin IN ('USER', 'AI', 'IMPORT', 'CLONE'));

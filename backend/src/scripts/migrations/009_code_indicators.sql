-- PRO code tier: a custom indicator can now be an EXPR (the safe grammar)
-- or CODE (JavaScript inside the QuickJS-WASM cage, PRO plans only).
-- Safe to run more than once.

ALTER TABLE public.custom_indicators ADD COLUMN IF NOT EXISTS kind VARCHAR(10)
    NOT NULL DEFAULT 'EXPR' CHECK (kind IN ('EXPR', 'CODE'));

ALTER TABLE public.custom_indicators ADD COLUMN IF NOT EXISTS code TEXT;

-- EXPR rows keep their expression; CODE rows have none.
ALTER TABLE public.custom_indicators ALTER COLUMN expr DROP NOT NULL;

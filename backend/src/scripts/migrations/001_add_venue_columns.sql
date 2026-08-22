-- Adds the columns the two trading modes need to an existing database.
-- Safe to run more than once.
--
-- `venue` records which engine owns a position: SIMULATED rows are matched by
-- our own engine, CTRADER rows mirror a position held at the broker (where the
-- broker is the book of record and the row is a local copy for history/UI).

ALTER TABLE public.positions
    ADD COLUMN IF NOT EXISTS venue VARCHAR(20) NOT NULL DEFAULT 'SIMULATED';

ALTER TABLE public.positions
    ADD COLUMN IF NOT EXISTS broker_position_id VARCHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'positions_venue_check'
    ) THEN
        ALTER TABLE public.positions
            ADD CONSTRAINT positions_venue_check
            CHECK (venue IN ('SIMULATED', 'CTRADER'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_broker_ref
    ON public.positions (account_id, broker_position_id)
    WHERE broker_position_id IS NOT NULL;

-- Account records live in users.ctrader_accounts (JSONB); a live account gains
-- `ctidTraderAccountId` and optionally `venue` when it is linked, so no schema
-- change is needed there.

-- Admin audit trail.
--
-- Every mutation made from the admin panel is written here before the
-- response goes out: who did it, to what, and what changed. Without it a
-- role change, a plan grant or a force-closed position is indistinguishable
-- from the row having always looked that way — and with more than one admin
-- there is no way to answer "who did this".
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.admin_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- The admin who performed it. Kept as a plain column rather than a
    -- foreign key with ON DELETE CASCADE: deleting an account must not
    -- erase the record of what that account did.
    actor_id UUID,
    actor_username VARCHAR(30),
    -- e.g. 'user.role', 'broker.delete', 'position.close'
    action VARCHAR(60) NOT NULL,
    -- What was acted on: table-ish name plus the row id.
    target_type VARCHAR(40),
    target_id VARCHAR(64),
    -- A short human sentence, rendered by the writer, plus the raw before /
    -- after for anything a sentence cannot carry.
    summary TEXT,
    detail JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit(target_type, target_id);

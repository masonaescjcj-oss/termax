/**
 * ADMIN AUDIT TRAIL
 *
 * Every mutation the admin panel makes is recorded here. Two reasons it is
 * a service rather than a line inside each handler: the write must never be
 * able to fail the action it describes (an audit table that is missing, or
 * a Supabase hiccup, must not stop an admin from demoting an abusive user),
 * and the sentence that ends up in the log should be written next to the
 * change it describes rather than reconstructed later from a diff.
 *
 * The write is deliberately fire-and-forget. If it throws, the failure is
 * logged to the server console and the request carries on.
 */

import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

export type AuditEntry = {
    action: string;
    targetType?: string;
    targetId?: string;
    summary: string;
    detail?: Record<string, unknown>;
};

/**
 * Record one admin action. Never throws, never awaited for correctness —
 * call it and move on.
 */
export function recordAdminAction(req: AuthRequest, entry: AuditEntry): void {
    const row = {
        actor_id: isUuid(req.user?.id) ? req.user!.id : null,
        actor_username: req.user?.username ?? null,
        action: entry.action,
        target_type: entry.targetType ?? null,
        target_id: entry.targetId ? String(entry.targetId).slice(0, 64) : null,
        summary: entry.summary,
        detail: entry.detail ?? {},
    };

    void supabase
        .from('admin_audit')
        .insert(row)
        .then(({ error }: any) => {
            if (error) console.warn('[Audit] Could not record admin action:', error.message);
        });
}

/** The audit log, newest first. */
export async function readAuditLog(opts: {
    limit?: number;
    before?: string;
    action?: string;
    actorId?: string;
} = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
    let q = supabase
        .from('admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (opts.before) q = q.lt('created_at', opts.before);
    if (opts.action) q = q.eq('action', opts.action);
    if (opts.actorId) q = q.eq('actor_id', opts.actorId);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return (data || []).map((r: any) => ({
        id: r.id,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        summary: r.summary,
        detail: r.detail || {},
        createdAt: r.created_at,
    }));
}

/**
 * The fallback session ids look like `user_12345`, which is not a UUID and
 * would be rejected by the column. Those sessions can never be admin, but
 * the guard keeps a malformed id from failing the insert silently.
 */
function isUuid(v: unknown): boolean {
    return typeof v === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

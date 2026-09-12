import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { challengeAndVerify, enrollTotp, forgetFactors, listFactors, MfaError, unenroll } from '../services/mfa';

const bearer = (req: AuthRequest): string => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

const fail = (res: Response, e: any) => {
    if (e instanceof MfaError) return res.status(e.status).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, error: e.message });
};

/** GET /auth/mfa — the factors on this account. */
export const getFactors = async (req: AuthRequest, res: Response) => {
    try {
        const factors = await listFactors(bearer(req));
        res.status(200).json({ success: true, data: { factors, enabled: factors.some(f => f.status === 'verified') } });
    } catch (e: any) { fail(res, e); }
};

/** POST /auth/mfa/enroll — a new, still unverified, TOTP factor. */
export const startEnrollment = async (req: AuthRequest, res: Response) => {
    try {
        const name = String(req.body?.friendlyName ?? 'Authenticator app').slice(0, 40);
        const data = await enrollTotp(bearer(req), name);
        res.status(201).json({ success: true, data });
    } catch (e: any) { fail(res, e); }
};

/**
 * POST /auth/mfa/verify — confirm a code.
 *
 * The same call finishes enrolment and completes a sign-in: in both cases
 * a correct code promotes the session, and the fresh tokens come back for
 * the client to store.
 */
export const verifyFactor = async (req: AuthRequest, res: Response) => {
    try {
        const factorId = String(req.body?.factorId ?? '');
        const code = String(req.body?.code ?? '').replace(/\s+/g, '');
        if (!factorId) return res.status(400).json({ success: false, message: 'factorId is required.' });
        if (!/^\d{6,8}$/.test(code)) return res.status(400).json({ success: false, message: 'Enter the 6-digit code from your authenticator app.' });

        const session = await challengeAndVerify(bearer(req), factorId, code);
        forgetFactors(req.user!.id);
        res.status(200).json({ success: true, data: session });
    } catch (e: any) { fail(res, e); }
};

/** DELETE /auth/mfa/:factorId — turn two-factor off (needs an aal2 session). */
export const removeFactor = async (req: AuthRequest, res: Response) => {
    try {
        await unenroll(bearer(req), String(req.params.factorId));
        forgetFactors(req.user!.id);
        res.status(200).json({ success: true });
    } catch (e: any) { fail(res, e); }
};

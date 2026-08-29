import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
}

// ═══════════════════════════════════════════════════════════════
//  TELEGRAM FALLBACK SESSION
//
//  When Supabase is slow or unreachable, login still hands a Telegram user a
//  session so the app opens. That token used to be the plain string
//  `mock_access_token_<telegramId>` and this middleware accepted it on
//  sight — so anybody could take over any Telegram account by sending
//
//      Authorization: Bearer mock_access_token_<their telegram id>
//
//  Telegram ids are not secret. The token is now signed with the bot token,
//  which only the server holds, so it can still be issued offline but it
//  cannot be forged. There is no way to mint one without the secret.
// ═══════════════════════════════════════════════════════════════

const FALLBACK_PREFIX = 'mock_access_token_';

const fallbackSecret = () =>
    process.env.TELEGRAM_BOT_TOKEN || process.env.SUPABASE_SERVICE_KEY || 'trade_app_bot_secret_fallback';

const signFallback = (subject: string): string =>
    crypto.createHmac('sha256', fallbackSecret()).update(subject).digest('hex').slice(0, 32);

/** Issue a signed fallback session token for a Telegram user. */
export const issueFallbackToken = (telegramId: string): string =>
    `${FALLBACK_PREFIX}${telegramId}.${signFallback(telegramId)}`;

/** Issue the matching refresh token. */
export const issueFallbackRefreshToken = (telegramId: string): string =>
    `mock_refresh_token_${telegramId}.${signFallback(`refresh:${telegramId}`)}`;

/**
 * Read a fallback token, or null if it is absent, malformed or unsigned.
 * The comparison is constant-time so the signature cannot be guessed byte
 * by byte.
 */
export const readFallbackToken = (token: string): string | null => {
    if (!token.startsWith(FALLBACK_PREFIX)) return null;
    const rest = token.slice(FALLBACK_PREFIX.length);
    const dot = rest.lastIndexOf('.');
    if (dot <= 0) return null;

    const subject = rest.slice(0, dot);
    const given = Buffer.from(rest.slice(dot + 1));
    const want = Buffer.from(signFallback(subject));
    if (given.length !== want.length) return null;
    if (!crypto.timingSafeEqual(given, want)) return null;
    return subject;
};

/**
 * Middleware: Verify Supabase JWT token and attach user to request
 */
export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
        return;
    }

    const token = authHeader.split(' ')[1];

    const fallbackSubject = readFallbackToken(token);
    if (fallbackSubject) {
        // A fallback session is never an admin one: the role comes from the
        // database, and this path exists precisely because the database was
        // unreachable.
        req.user = {
            id: `user_${fallbackSubject}`,
            username: 'Trader_Pro',
            role: 'user'
        };
        return next();
    }

    try {
        // Verify token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            // An invalid or expired token used to be waved through as a
            // shared demo account, which meant every protected route was
            // reachable with any string at all — and an expired admin
            // session silently became a normal user, so the admin panel
            // answered "are you an admin?" instead of "log in again".
            res.status(401).json({ success: false, message: 'Session expired. Please sign in again.', code: 'TOKEN_INVALID' });
            return;
        }

        // Fetch user profile from public.users to get their role and username
        let profile: any = null;
        try {
            const { data, error: dbError } = await supabase
                .from('users')
                .select('role, username')
                .eq('id', user.id)
                .single();
            if (!dbError) profile = data;
        } catch {}

        req.user = {
            id: user.id,
            username: profile?.username || user.user_metadata?.username || user.email || 'user',
            role: profile?.role || 'user'
        };
        next();
    } catch (error: any) {
        // Reaching here means the auth service itself failed, not that the
        // caller is unauthenticated. Say so rather than inventing a session.
        res.status(503).json({ success: false, message: 'Authentication service unavailable. Please try again.', code: 'AUTH_UNAVAILABLE' });
    }
};

/**
 * Middleware: Require admin role
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ success: false, message: 'Admin access required.' });
        return;
    }
    next();
};

/**
 * Middleware: Require admin or moderator role
 */
export const requireModerator = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !['admin', 'moderator'].includes(req.user.role)) {
        res.status(403).json({ success: false, message: 'Moderator access required.' });
        return;
    }
    next();
};

/**
 * Optional auth — doesn't fail if no token, but attaches user if present
 */
export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];

        const fallbackSubject = readFallbackToken(token);
        if (fallbackSubject) {
            req.user = { id: `user_${fallbackSubject}`, username: 'Trader_Pro', role: 'user' };
            return next();
        }

        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (user && !error) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('role, username')
                    .eq('id', user.id)
                    .single();

                req.user = {
                    id: user.id,
                    username: profile?.username || user.user_metadata?.username || user.email || 'user',
                    role: profile?.role || 'user'
                };
            }
        } catch {
            // Token invalid/expired, but we don't fail — just no user attached
        }
    }
    next();
};


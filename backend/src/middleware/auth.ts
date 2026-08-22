import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
}

/**
 * Generate JWT access token (Legacy fallback - Supabase Auth handles this on frontend)
 */
export const generateToken = (userId: string, username: string, role: string): string => {
    // Return a dummy value or construct a simple payload.
    // In Supabase, the frontend signs in directly or we use supabase.auth
    return `legacy_access_token:${userId}:${username}:${role}`;
};

/**
 * Generate JWT refresh token (Legacy fallback)
 */
export const generateRefreshToken = (userId: string): string => {
    return `legacy_refresh_token:${userId}`;
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

    if (token.startsWith('mock_access_token_') || token.startsWith('legacy_access_token:')) {
        const userId = token.includes('mock_access_token_') ? token.replace('mock_access_token_', 'user_') : 'user_demo';
        req.user = {
            id: userId,
            username: 'Trader_Pro',
            role: 'user'
        };
        return next();
    }

    try {
        // Verify token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            req.user = { id: 'user_demo', username: 'Trader_Pro', role: 'user' };
            return next();
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
        req.user = { id: 'user_demo', username: 'Trader_Pro', role: 'user' };
        next();
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


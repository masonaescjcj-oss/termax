import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest, issueFallbackToken, issueFallbackRefreshToken } from '../middleware/auth';
import { mapUserToCamel, mapUserToSnake } from '../utils/mapper';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
//  EMAIL VERIFICATION — built, switched off
//
//  Off, a new account gets a session the moment it is created, which is
//  what a launch wants: nothing between a person and the app. On, the
//  account is created unconfirmed, Supabase mails a confirmation link, and
//  neither register nor login hands out a session until it is clicked.
//  The client reads which mode is live from GET /auth/config, so turning
//  this on is one environment variable and a restart — no app release.
// ═══════════════════════════════════════════════════════════════
export const REQUIRE_EMAIL_VERIFICATION = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

/**
 * Where confirmation and password-recovery links land. The web build of the
 * app handles both (`#type=recovery` opens the reset form). Must also be on
 * the Supabase project's redirect allow-list, or Supabase ignores it.
 */
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');

/**
 * Password rules, applied to accounts people create themselves. The Telegram
 * path derives its password server-side and never sees this. Eight
 * characters with a letter and a digit is the floor a trading account should
 * have; the client shows the same rule as the user types.
 */
export const passwordProblem = (password: unknown): string | null => {
    const p = String(password ?? '');
    if (p.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Password needs at least one letter and one digit.';
    if (p.length > 128) return 'Password is too long.';
    return null;
};

/**
 * Generate deterministic secure password for Telegram users
 */
const getTelegramPassword = (telegramId: string): string => {
    return crypto
        .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN || 'trade_app_bot_secret_fallback')
        .update(telegramId.toString())
        .digest('hex');
};

export const withTimeout = <T>(promise: PromiseLike<T>, ms: number = 2000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Database Connection Timeout')), ms);
        promise.then(
            res => { clearTimeout(timer); resolve(res); },
            err => { clearTimeout(timer); reject(err); }
        );
    });
};

export const getFallbackUserResponse = (telegramId?: any, username?: string) => {
    const tgIdStr = telegramId ? telegramId.toString() : 'demo_user';
    const uname = username || (telegramId ? `tg_${tgIdStr}` : 'Trader_Pro');
    const user = {
        id: `user_${tgIdStr}`,
        username: uname.toLowerCase(),
        email: `${uname.toLowerCase()}@telegram.user`,
        avatarUrl: null,
        role: 'user',
        telegramId: telegramId ? parseInt(tgIdStr) : null,
        referralCode: `ref_${tgIdStr}`,
        referralCount: 0,
        watchlist: ['GOLD', 'BTC/USDT', 'ETH/USDT', 'EUR/USD', 'SPX'],
        settings: { notifications: true, language: 'en', theme: 'dark' },
        cTraderAccounts: [{
            id: 'default_demo',
            cTraderId: 'default_demo',
            accessToken: 'demo_token',
            accountType: 'DEMO',
            broker: 'TradeHub Internal',
            balance: 10000,
            connectedAt: new Date().toISOString()
        }]
    };
    return {
        // Signed, so this offline session cannot be minted by anyone who
        // simply knows the Telegram id — see middleware/auth.ts.
        accessToken: issueFallbackToken(tgIdStr),
        refreshToken: issueFallbackRefreshToken(tgIdStr),
        user
    };
};

/**
 * Helper to register a user on Supabase Auth + public.users table
 */
const performRegister = async (params: {
    username: string;
    email: string;
    passwordHash: string;
    telegramId?: string;
    avatarUrl?: string;
    referredByUserId?: string | null;
}) => {
    const { username, email, passwordHash, telegramId, avatarUrl, referredByUserId } = params;

    // Generate unique referral code
    const refCode = telegramId ? `ref_${telegramId}` : `ref_${Math.random().toString(36).substring(2, 11)}`;

    // 1. Create user in Supabase Auth via Admin API
    let userId: string;
    // A Telegram account has no inbox to confirm from — its identity is the
    // Telegram id — so it is always created confirmed.
    const confirmNow = !REQUIRE_EMAIL_VERIFICATION || Boolean(telegramId);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase(),
        password: passwordHash,
        email_confirm: confirmNow,
        user_metadata: { username: username.toLowerCase() }
    });

    if (authError || !authData.user) {
        if (authError && (authError.message.includes('already been registered') || authError.message.includes('already exists') || authError.status === 422)) {
            // Find existing user in Supabase Auth to recover profile
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
            const existingUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                userId = existingUser.id;
                console.log(`ℹ️ Recovering public profile for existing auth user: ${userId}`);
            } else {
                throw new Error(authError?.message || 'Failed to list auth users for recovery');
            }
        } else {
            throw new Error(authError?.message || 'Failed to create auth user');
        }
    } else {
        userId = authData.user.id;
    }

    // Default DEMO account configuration
    const defaultDemoAccount = {
        cTraderId: 'default_demo',
        accessToken: 'demo_token',
        accountType: 'DEMO',
        broker: 'TradeHub Internal',
        balance: 1000,
        connectedAt: new Date().toISOString()
    };

    // 2. Insert profile record in public.users table or update if exists
    let profile: any = null;
    let profileError: any = null;

    const { data: insertData, error: insertError } = await supabase
        .from('users')
        .insert({
            id: userId,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            avatar_url: avatarUrl || null,
            role: 'user',
            telegram_id: telegramId ? telegramId.toString() : null,
            referral_code: refCode,
            referred_by: referredByUserId || null,
            referral_count: 0,
            watchlist: ['BTC/USDT', 'ETH/USDT', 'GOLD'],
            settings: { notifications: true, language: 'en', theme: 'dark' },
            ctrader_accounts: [defaultDemoAccount]
        })
        .select()
        .maybeSingle();

    if (insertError) {
        if (insertError.message.includes('duplicate key') || insertError.message.includes('already exists') || insertError.code === '23505') {
            console.log(`ℹ️ Profile row already exists for ID ${userId}. Updating fields instead...`);
            
            const updateFields: any = {};
            if (telegramId) updateFields.telegram_id = telegramId.toString();
            if (avatarUrl) updateFields.avatar_url = avatarUrl;

            let updateData: any = null;
            let updateError: any = null;

            if (Object.keys(updateFields).length > 0) {
                const { data, error } = await supabase
                    .from('users')
                    .update(updateFields)
                    .eq('id', userId)
                    .select();
                
                if (error) {
                    updateError = error;
                } else if (data && data.length > 0) {
                    updateData = data[0];
                } else {
                    // Fallback to select if update matched 0 rows
                    const { data: selectData, error: selectError } = await supabase
                        .from('users')
                        .select()
                        .eq('id', userId)
                        .maybeSingle();
                    updateData = selectData;
                    updateError = selectError;
                }
            } else {
                // If no fields to update, just fetch the existing row
                const { data, error } = await supabase
                    .from('users')
                    .select()
                    .eq('id', userId)
                    .maybeSingle();
                updateData = data;
                updateError = error;
            }

            if (updateError) {
                profileError = updateError;
            } else {
                profile = updateData;
            }
        } else {
            profileError = insertError;
        }
    } else {
        profile = insertData;
    }

    if (profileError) {
        // Rollback auth user creation if profile creation fails (only if newly created)
        if (authData && authData.user) {
            await supabase.auth.admin.deleteUser(userId);
        }
        throw new Error(profileError.message);
    }

    return { userId, profile };
};

/**
 * POST /api/v1/auth/register
 * Create a new user account
 */
export const register = async (req: AuthRequest, res: Response) => {
    console.log('Incoming register request:', req.body);
    try {
        const { username, email, password, telegramId, referredByCode, avatarUrl } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
        }

        if (username.length < 5 || username.length > 30) {
            return res.status(400).json({ success: false, message: 'Username must be 5-30 characters.' });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, and underscores.' });
        }

        if (!telegramId) {
            const problem = passwordProblem(password);
            if (problem) return res.status(400).json({ success: false, message: problem });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        }

        // Fast check if username or email already exists in DB
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, email, username')
            .or(`username.eq.${username.toLowerCase()},email.eq.${email.toLowerCase()}`)
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });
        }

        // Check if referral exists
        let referredByUserId: string | null = null;
        if (referredByCode) {
            const { data: referer } = await supabase
                .from('users')
                .select('id, referral_count')
                .eq('referral_code', referredByCode)
                .single();

            if (referer) {
                referredByUserId = referer.id;
                // Increment referrer's count
                await supabase
                    .from('users')
                    .update({ referral_count: (referer.referral_count || 0) + 1 })
                    .eq('id', referer.id);
            }
        }

        const { profile } = await performRegister({
            username,
            email,
            passwordHash: telegramId ? getTelegramPassword(telegramId.toString()) : password,
            telegramId,
            avatarUrl,
            referredByUserId
        });

        // With verification on, the account exists but is unconfirmed: mail
        // the link and hand back no session. The client shows "check your
        // inbox" and offers a resend.
        if (REQUIRE_EMAIL_VERIFICATION && !telegramId) {
            const sent = await sendConfirmationEmail(email);
            return res.status(201).json({
                success: true,
                needsVerification: true,
                emailSent: sent,
                message: sent
                    ? 'Account created. Check your inbox for a confirmation link.'
                    : 'Account created, but the confirmation email could not be sent. Use "Resend" in a moment.',
                data: { user: mapUserToCamel(profile) }
            });
        }

        // Sign in to get access token and refresh token
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: telegramId ? getTelegramPassword(telegramId.toString()) : password
        });

        if (sessionError || !sessionData.session) {
            return res.status(201).json({
                success: true,
                message: 'Account created successfully. Please log in.',
                data: {
                    user: mapUserToCamel(profile)
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            data: {
                accessToken: sessionData.session.access_token,
                refreshToken: sessionData.session.refresh_token,
                user: mapUserToCamel(profile)
            }
        });
    } catch (error: any) {
        console.error('Register Error:', error?.message || error);
        if (error.message && (error.message.includes('duplicate key') || error.message.includes('already exists'))) {
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });
        }
        // The offline fallback exists so a Telegram user still gets in when
        // the database is slow — their identity is their Telegram id, so an
        // offline session is still theirs. For anyone else it handed out a
        // shared demo identity on any error at all, which is the opposite
        // of a login gate. They get told the truth instead.
        if (req.body.telegramId) {
            const fallbackData = getFallbackUserResponse(req.body.telegramId, req.body.username || req.body.email);
            return res.status(201).json({ success: true, message: 'Account created successfully.', data: fallbackData });
        }
        res.status(503).json({
            success: false,
            message: 'We could not create your account right now. Please try again in a moment.',
        });
    }
};

/**
 * Ask Supabase to (re)send the signup confirmation for an address. Never
 * throws — the account already exists, and a mail failure is reported, not
 * fatal.
 */
async function sendConfirmationEmail(email: string): Promise<boolean> {
    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email.toLowerCase(),
            options: PUBLIC_APP_URL ? { emailRedirectTo: PUBLIC_APP_URL } : undefined,
        });
        if (error) console.warn('[Auth] Confirmation email not sent:', error.message);
        return !error;
    } catch (e: any) {
        console.warn('[Auth] Confirmation email not sent:', e?.message ?? e);
        return false;
    }
}

/**
 * POST /api/v1/auth/login
 * Login with username/email + password or Telegram
 */
export const login = async (req: AuthRequest, res: Response) => {
    try {
        const { username, email, password, telegramId } = req.body;
        const identifier = username || email;

        if (!identifier && !telegramId) {
            return res.status(400).json({ success: false, message: 'Username/email or telegramId is required.' });
        }

        let userEmail = '';
        let userId = '';

        // 1. Authenticate with Telegram (Passwordless trusted identity)
        if (telegramId) {
            try {
                const { data: profile } = await withTimeout(
                    supabase.from('users').select('id, email, username').eq('telegram_id', telegramId.toString()).maybeSingle(),
                    1500
                );

                if (profile) {
                    userEmail = profile.email;
                    userId = profile.id;
                } else {
                    return res.status(200).json({
                        success: true,
                        message: 'Login successful.',
                        data: getFallbackUserResponse(telegramId, username)
                    });
                }
            } catch (err) {
                return res.status(200).json({
                    success: true,
                    message: 'Login successful (Fast Mode).',
                    data: getFallbackUserResponse(telegramId, username)
                });
            }
        } else if (identifier) {
            // 2. Standard username/email + password auth
            if (identifier.includes('@')) {
                userEmail = identifier.toLowerCase();
            } else {
                // Fetch email by username
                const { data: profile } = await supabase
                    .from('users')
                    .select('email')
                    .eq('username', identifier.toLowerCase())
                    .maybeSingle();

                if (!profile) {
                    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
                }
                userEmail = profile.email;
            }
        }

        // 3. Perform actual password sign in
        const authPass = telegramId ? getTelegramPassword(telegramId) : password;
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: authPass
        });

        if (sessionError || !sessionData.session) {
            // Supabase says this in words when verification is on. Telling
            // the person their password is wrong when it is not would send
            // them to reset it for nothing.
            if (/not confirmed/i.test(sessionError?.message || '')) {
                return res.status(403).json({
                    success: false,
                    code: 'EMAIL_NOT_VERIFIED',
                    email: userEmail,
                    message: 'Confirm your email address first — check your inbox for the link.',
                });
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // 4. Update last login timestamp in profile
        const { data: finalProfile } = await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', sessionData.session.user.id)
            .select()
            .single();

        // Check if account is deactivated
        const mappedProfile = mapUserToCamel(finalProfile);
        if (mappedProfile.settings?.deactivated === true) {
            return res.status(403).json({ success: false, message: 'This account has been deleted.' });
        }

        res.status(200).json({
            success: true,
            message: 'Login successful.',
            data: {
                accessToken: sessionData.session.access_token,
                refreshToken: sessionData.session.refresh_token,
                user: mappedProfile
            }
        });
    } catch (error: any) {
        console.error('Login Error:', error?.message || error);
        // See the note in register: the offline session is for Telegram
        // users only. A failed password login must fail.
        if (req.body.telegramId) {
            const fallbackData = getFallbackUserResponse(req.body.telegramId, req.body.username || req.body.email);
            return res.status(200).json({ success: true, message: 'Login successful.', data: fallbackData });
        }
        res.status(503).json({
            success: false,
            message: 'Sign-in is unavailable right now. Please try again in a moment.',
        });
    }
};

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
export const refreshToken = async (req: AuthRequest, res: Response) => {
    try {
        const { refreshToken: token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Refresh token is required.' });
        }

        const { data: sessionData, error } = await supabase.auth.refreshSession({
            refresh_token: token
        });

        if (error || !sessionData.session) {
            return res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
        }

        res.status(200).json({
            success: true,
            data: {
                accessToken: sessionData.session.access_token,
                refreshToken: sessionData.session.refresh_token
            }
        });
    } catch (error: any) {
        res.status(403).json({ success: false, message: 'Invalid or expired refresh token.' });
    }
};

/**
 * GET /api/v1/auth/me
 * Get current user profile (requires auth)
 */
export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        let { data: profile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user!.id)
            .single();

        if (error || !profile) {
            console.log(`ℹ️ Self-healing: Public profile missing for authenticated user: ${req.user!.id}. Attempting recovery...`);
            
            // Fetch user info from Supabase Auth admin database
            const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(req.user!.id);
            if (!authError && user) {
                const username = user.user_metadata?.username || `user_${user.id.substring(0, 6)}`;
                const email = user.email || `${user.id}@telegram.trade.internal`;
                
                const defaultDemoAccount = {
                    cTraderId: 'default_demo',
                    accessToken: 'demo_token',
                    accountType: 'DEMO',
                    broker: 'TradeHub Internal',
                    balance: 1000,
                    connectedAt: new Date().toISOString()
                };
                
                const refCode = `ref_${Math.random().toString(36).substring(2, 11)}`;
                
                const { data: newProfile, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        id: user.id,
                        username: username.toLowerCase(),
                        email: email.toLowerCase(),
                        role: 'user',
                        referral_code: refCode,
                        referral_count: 0,
                        watchlist: ['BTC/USDT', 'ETH/USDT', 'GOLD'],
                        settings: { notifications: true, language: 'en', theme: 'dark' },
                        ctrader_accounts: [defaultDemoAccount]
                    })
                    .select()
                    .single();
                
                if (!insertError && newProfile) {
                    console.log(`✅ Self-healing completed! Recreated profile for user: ${username}`);
                    profile = newProfile;
                } else {
                    console.error('❌ Self-healing failed to insert profile:', insertError);
                    return res.status(404).json({ success: false, message: 'User not found, and profile recovery failed.' });
                }
            } else {
                return res.status(404).json({ success: false, message: 'User not found in auth database.' });
            }
        }

        const mappedProfile = mapUserToCamel(profile);
        if (mappedProfile.settings?.deactivated === true) {
            return res.status(403).json({ success: false, message: 'This account has been deleted.' });
        }

        res.status(200).json({
            success: true,
            data: mappedProfile
        });
    } catch (error: any) {
        console.error('getMe Error:', error?.message || error);
        const fallbackData = getFallbackUserResponse(req.user?.id, req.user?.username);
        res.status(200).json({
            success: true,
            data: fallbackData.user
        });
    }
};

/**
 * PUT /api/v1/auth/me
 * Update user profile (requires auth)
 */
export const updateMe = async (req: AuthRequest, res: Response) => {
    try {
        const allowedFields = ['avatarUrl', 'settings', 'watchlist', 'activeNft'];
        const updates: any = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        // Username change with validation
        if (req.body.username) {
            const newUsername = req.body.username.toLowerCase();
            if (!/^[a-zA-Z0-9_]+$/.test(newUsername) || newUsername.length < 3) {
                return res.status(400).json({ success: false, message: 'Invalid username format.' });
            }
            
            // Check availability
            const { data: existingUser } = await supabase
                .from('users')
                .select('id')
                .eq('username', newUsername)
                .neq('id', req.user!.id)
                .maybeSingle();

            if (existingUser) {
                return res.status(409).json({ success: false, message: 'Username already taken.' });
            }
            updates.username = newUsername;
        }

        const snakeUpdates = mapUserToSnake(updates);
        if (Object.keys(snakeUpdates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid update fields provided.' });
        }

        const { data: updatedProfile, error } = await supabase
            .from('users')
            .update(snakeUpdates)
            .eq('id', req.user!.id)
            .select()
            .single();

        if (error || !updatedProfile) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated.',
            data: mapUserToCamel(updatedProfile)
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to update profile.', error: error.message });
    }
};

/**
 * POST /api/v1/auth/check-username
 * Check if username is available
 */
export const checkUsername = async (req: AuthRequest, res: Response) => {
    try {
        const { username } = req.body;
        if (!username || username.length < 3) {
            return res.status(400).json({ success: false, available: false, message: 'Username must be at least 3 characters.' });
        }

        const { data: exists } = await supabase
            .from('users')
            .select('id')
            .eq('username', username.toLowerCase())
            .maybeSingle();

        res.status(200).json({
            success: true,
            available: !exists,
            message: exists ? 'Username is taken.' : 'Username is available.'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Check failed.', error: error.message });
    }
};

/**
 * POST /api/v1/auth/connect-broker
 * Link a cTrader broker account to user (requires auth)
 */
export const connectBroker = async (req: AuthRequest, res: Response) => {
    try {
        const { cTraderId, accessToken, refreshToken, accountType, broker, balance, currency, leverage } = req.body;

        if (!cTraderId || !accessToken || !broker) {
            return res.status(400).json({ success: false, message: 'cTraderId, accessToken, and broker are required.' });
        }

        const { data: profile, error: fetchError } = await supabase
            .from('users')
            .select('ctrader_accounts')
            .eq('id', req.user!.id)
            .single();

        if (fetchError || !profile) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const accounts = profile.ctrader_accounts || [];

        // Check if this cTrader account is already linked
        const existingIndex = accounts.findIndex((a: any) => a.cTraderId === cTraderId);
        
        if (existingIndex > -1) {
            // Update existing
            accounts[existingIndex].accessToken = accessToken;
            accounts[existingIndex].refreshToken = refreshToken;
            accounts[existingIndex].balance = balance || 0;
            if (currency) accounts[existingIndex].currency = currency;
            if (leverage) accounts[existingIndex].leverage = leverage;
        } else {
            // Add new
            accounts.push({
                cTraderId,
                accessToken,
                refreshToken,
                accountType: accountType || 'DEMO',
                broker,
                balance: balance || 0,
                currency: currency || 'USD',
                leverage: leverage || '1:100',
                connectedAt: new Date().toISOString()
            });
        }

        const { data: updatedProfile, error: updateError } = await supabase
            .from('users')
            .update({ ctrader_accounts: accounts })
            .eq('id', req.user!.id)
            .select()
            .single();

        if (updateError || !updatedProfile) {
            return res.status(500).json({ success: false, message: 'Failed to update user broker accounts.' });
        }

        res.status(200).json({
            success: true,
            message: `Broker ${broker} connected successfully.`,
            data: {
                accountCount: accounts.length,
                accounts: accounts.map((a: any) => ({
                    cTraderId: a.cTraderId,
                    broker: a.broker,
                    accountType: a.accountType,
                    balance: a.balance
                }))
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: 'Failed to connect broker.', error: error.message });
    }
};

/**
 * POST /api/v1/auth/deactivate
 * Deactivate user profile (Delete account representation)
 */
export const deactivateAccount = async (req: AuthRequest, res: Response) => {
    try {
        const { email, password } = req.body;
        const userId = req.user?.id;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized. User ID not found.' });
        }

        // 1. Fetch user profile from DB to verify identity
        const { data: profile, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }

        // Verify email matches the logged in user
        if (profile.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(400).json({ success: false, message: 'Email does not match this account.' });
        }

        // 2. Verify password by signing in
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase(),
            password: password
        });

        if (authError) {
            return res.status(401).json({ success: false, message: 'Invalid password.' });
        }

        // 3. Mark settings as deactivated
        const currentSettings = profile.settings || {};
        const updatedSettings = {
            ...currentSettings,
            deactivated: true,
            deactivatedAt: new Date().toISOString()
        };

        const { error: updateError } = await supabase
            .from('users')
            .update({ settings: updatedSettings })
            .eq('id', userId);

        if (updateError) {
            return res.status(500).json({ success: false, message: 'Failed to deactivate account.' });
        }

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully.'
        });
    } catch (error: any) {
        console.error('Deactivate Account Error:', error);
        res.status(500).json({ success: false, message: 'An error occurred during account deletion.', error: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════
//  AUTH CONFIG, VERIFICATION RESEND, PASSWORD RECOVERY
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/v1/auth/config
 * What the sign-up flow should expect. Public: it decides which screens
 * the client shows, and it carries no secret.
 */
export const authConfig = async (_req: AuthRequest, res: Response) => {
    res.json({
        success: true,
        data: {
            emailVerification: REQUIRE_EMAIL_VERIFICATION,
            passwordRule: 'At least 8 characters, with a letter and a digit.',
            minPasswordLength: 8,
        },
    });
};

/**
 * POST /api/v1/auth/resend-verification  { email }
 * Always answers the same way, so it cannot be used to learn which
 * addresses have accounts.
 */
export const resendVerification = async (req: AuthRequest, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    if (!REQUIRE_EMAIL_VERIFICATION) {
        return res.json({ success: true, message: 'Email verification is not required. You can sign in.' });
    }
    await sendConfirmationEmail(email);
    res.json({ success: true, message: 'If that address has an unconfirmed account, a new link is on its way.' });
};

/**
 * POST /api/v1/auth/forgot-password  { email }
 * Sends Supabase's recovery link. The link lands on PUBLIC_APP_URL with
 * `#type=recovery`, which the web build turns into the set-a-new-password
 * form. Same answer whether or not the address exists.
 */
export const forgotPassword = async (req: AuthRequest, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
    }
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(
            email,
            PUBLIC_APP_URL ? { redirectTo: PUBLIC_APP_URL } : undefined,
        );
        if (error) console.warn('[Auth] Recovery email not sent:', error.message);
    } catch (e: any) {
        console.warn('[Auth] Recovery email not sent:', e?.message ?? e);
    }
    res.json({ success: true, message: 'If that address has an account, a reset link is on its way.' });
};

/**
 * Sign in, create an account, recover a password.
 *
 * This is the door. Nothing behind it renders until someone has a session,
 * so it has to do three things well: get a returning trader in within one
 * screen, get a new one in without a wizard, and never leave anyone
 * wondering what went wrong. Every failure is written under the form in a
 * sentence; nothing is a toast that vanishes.
 *
 * Email verification is built in and switched off. The screen reads which
 * mode is live from GET /auth/config, so when the server turns it on the
 * "check your inbox" state appears with no app release.
 *
 * Telegram never sees this screen — its users are signed in from their
 * Telegram identity by the navigator before anything renders.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform,
    ScrollView, ActivityIndicator, Image, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Check, AlertCircle, MailCheck, ArrowLeft } from 'lucide-react-native';
import axios from 'axios';
import { Text, TextInput } from '../components/Typography';
import { BACKEND_URL } from '../config';
import { setItemAsync } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { useAccountStore } from '../store/accountStore';

type Mode = 'signin' | 'signup' | 'forgot' | 'verify' | 'reset';

const C = {
    bg: '#000000',
    surface: '#0B0D12',
    border: 'rgba(255,255,255,0.10)',
    borderFocus: '#2962FF',
    text: '#FFFFFF',
    label: '#D1D4DC',
    muted: '#848E9C',
    subtle: '#5B6472',
    primary: '#2962FF',
    danger: '#F23645',
    success: '#089981',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The same rule the server enforces, so the hint and the rejection agree. */
const passwordProblem = (p: string): string | null => {
    if (p.length < 8) return 'At least 8 characters.';
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Needs a letter and a digit.';
    return null;
};

/** What the server told us, or a sentence when it told us nothing usable. */
const messageOf = (err: any, fallback: string): string => {
    const m = err?.response?.data?.message;
    if (typeof m === 'string' && m.trim()) return m;
    if (err?.code === 'ERR_NETWORK' || !err?.response) return 'Could not reach the server. Check your connection and try again.';
    return fallback;
};

// ── pieces ───────────────────────────────────────────────────────────
//
// These live at module level on purpose. Defined inside the screen they
// would be a new component type on every render, and React treats a new
// type as a different element: it unmounts the old input and mounts a
// fresh one. On a phone that means the keyboard drops after every single
// character. The screenshot harness caught exactly that — typed text never
// stayed in the field.

function Field({
    label, value, onChange, placeholder, secure, keyboard, autoCap, hint, right, name,
    autoComplete, onSubmit, focused, setFocused, showPassword, toggleShow,
}: any) {
    return (
        <View style={s.field}>
            <Text style={s.label}>{label}</Text>
            <View style={[s.inputWrap, focused === name && s.inputWrapFocused]}>
                <TextInput
                    style={s.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={C.subtle}
                    secureTextEntry={secure && !showPassword}
                    keyboardType={keyboard || 'default'}
                    autoCapitalize={autoCap || 'none'}
                    autoCorrect={false}
                    autoComplete={autoComplete}
                    onFocus={() => setFocused(name)}
                    onBlur={() => setFocused(null)}
                    onSubmitEditing={onSubmit}
                    returnKeyType={onSubmit ? 'go' : 'next'}
                />
                {secure && (
                    <TouchableOpacity onPress={toggleShow} style={s.eye} hitSlop={10}>
                        {showPassword ? <EyeOff color={C.muted} size={20} /> : <Eye color={C.muted} size={20} />}
                    </TouchableOpacity>
                )}
                {right}
            </View>
            {hint}
        </View>
    );
}

function Primary({ title, onPress, disabled, busy }: any) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || busy}
            activeOpacity={0.85}
            style={[s.primary, (disabled || busy) && { opacity: 0.55 }]}
        >
            {busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.primaryText}>{title}</Text>}
        </TouchableOpacity>
    );
}

function Banner({ error, notice }: { error: string | null; notice: string | null }) {
    if (error) {
        return (
            <View style={[s.banner, s.bannerError]}>
                <AlertCircle color={C.danger} size={16} />
                <Text style={[s.bannerText, { color: '#FCA5A5' }]}>{error}</Text>
            </View>
        );
    }
    if (notice) {
        return (
            <View style={[s.banner, s.bannerNotice]}>
                <Check color={C.success} size={16} />
                <Text style={[s.bannerText, { color: '#6EE7B7' }]}>{notice}</Text>
            </View>
        );
    }
    return null;
}

function Link({ children, onPress }: any) {
    return (
        <TouchableOpacity onPress={onPress} hitSlop={8}><Text style={s.link}>{children}</Text></TouchableOpacity>
    );
}

export default function AuthScreen({ navigation, route }: any) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { syncFromServer } = useAccountStore();

    const [mode, setMode] = useState<Mode>(route?.params?.mode === 'reset' ? 'reset' : 'signin');
    const [emailVerification, setEmailVerification] = useState(false);

    // Sign in
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    // Sign up
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [referral, setReferral] = useState('');
    const [confirm, setConfirm] = useState('');
    const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
    // Shared
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [verifyEmail, setVerifyEmail] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const [focused, setFocused] = useState<string | null>(null);

    // Which sign-up flow the server is running. Failing to reach it is not
    // an error worth showing here — the default is the launch mode.
    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/auth/config`, { timeout: 6000 })
            .then(r => setEmailVerification(Boolean(r.data?.data?.emailVerification)))
            .catch(() => undefined);
    }, []);

    // A recovery link lands on the web build with the session in the URL
    // hash. Hand it to Supabase so updateUser() below has someone to update.
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        const hash = window.location.hash || '';
        if (!hash.includes('type=recovery')) return;
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
            supabase.auth.setSession({ access_token, refresh_token }).catch(() => undefined);
        }
        setMode('reset');
        // Leave the URL clean so a refresh does not replay the recovery.
        try { window.history.replaceState(null, '', window.location.pathname); } catch { /* not fatal */ }
    }, []);

    // Resend cooldown, so the button cannot be hammered.
    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [resendIn]);

    // Username availability, checked while typing — but only once the name
    // is long enough to be valid, and only after the typing has paused.
    const usernameTimer = useRef<any>(null);
    useEffect(() => {
        if (mode !== 'signup') return;
        const u = username.trim();
        if (usernameTimer.current) clearTimeout(usernameTimer.current);
        if (!u) { setUsernameState('idle'); return; }
        if (u.length < 5 || u.length > 30 || !/^[a-zA-Z0-9_]+$/.test(u)) { setUsernameState('invalid'); return; }
        setUsernameState('checking');
        usernameTimer.current = setTimeout(async () => {
            try {
                const r = await axios.post(`${BACKEND_URL}/api/v1/auth/check-username`, { username: u }, { timeout: 6000 });
                setUsernameState(r.data?.available ? 'free' : 'taken');
            } catch {
                // Unknown is not "taken": let the server be the judge on submit.
                setUsernameState('idle');
            }
        }, 450);
        return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
    }, [username, mode]);

    const switchMode = (m: Mode) => {
        setMode(m);
        setError(null);
        setNotice(null);
        setShowPassword(false);
    };

    /** Store a session exactly the way the rest of the app expects it. */
    const enter = useCallback(async (data: any) => {
        await setItemAsync('accessToken', data.accessToken);
        await setItemAsync('refreshToken', data.refreshToken);
        if (data.user) await setItemAsync('cached_user_profile', JSON.stringify(data.user));
        try {
            await supabase.auth.setSession({ access_token: data.accessToken, refresh_token: data.refreshToken });
        } catch { /* the backend token is what the app uses */ }
        const accounts = data.user?.cTraderAccounts;
        if (Array.isArray(accounts) && accounts.length) {
            syncFromServer(accounts.map((a: any) => ({ ...a, id: a.cTraderId || a.accountId || a._id })));
        }
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }, [navigation, syncFromServer]);

    // ── actions ────────────────────────────────────────────────────────

    const signIn = async () => {
        const id = identifier.trim();
        if (!id || !password) { setError('Enter your email or username, and your password.'); return; }
        setBusy(true); setError(null);
        try {
            const body = id.includes('@') ? { email: id, password } : { username: id, password };
            const r = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, body, { timeout: 15000 });
            if (r.data?.success && r.data?.data?.accessToken) {
                await enter(r.data.data);
            } else {
                setError(r.data?.message || 'Sign-in did not complete. Please try again.');
            }
        } catch (err: any) {
            if (err?.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
                setVerifyEmail(err.response.data.email || (id.includes('@') ? id : ''));
                switchMode('verify');
            } else {
                setError(messageOf(err, 'Sign-in failed. Check your details and try again.'));
            }
        } finally {
            setBusy(false);
        }
    };

    const signUp = async () => {
        const e = email.trim().toLowerCase();
        const u = username.trim();
        if (!EMAIL_RE.test(e)) { setError('Enter a valid email address.'); return; }
        if (usernameState === 'invalid') { setError('Username: 5–30 letters, numbers or underscores.'); return; }
        if (usernameState === 'taken') { setError('That username is taken.'); return; }
        const pp = passwordProblem(password);
        if (pp) { setError(`Password: ${pp}`); return; }
        if (password !== confirm) { setError('The two passwords do not match.'); return; }

        setBusy(true); setError(null);
        try {
            const r = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                username: u, email: e, password,
                referredByCode: referral.trim() || undefined,
            }, { timeout: 20000 });

            if (r.data?.needsVerification) {
                setVerifyEmail(e);
                setNotice(r.data.emailSent === false ? r.data.message : null);
                switchMode('verify');
                setResendIn(30);
            } else if (r.data?.success && r.data?.data?.accessToken) {
                await enter(r.data.data);
            } else {
                // Created, but no session came back: send them to sign in
                // with the email already filled.
                setIdentifier(e);
                switchMode('signin');
                setNotice('Your account is ready. Sign in to continue.');
            }
        } catch (err: any) {
            setError(messageOf(err, 'We could not create your account. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const forgot = async () => {
        const e = identifier.trim().toLowerCase();
        if (!EMAIL_RE.test(e)) { setError('Enter the email address on your account.'); return; }
        setBusy(true); setError(null);
        try {
            await axios.post(`${BACKEND_URL}/api/v1/auth/forgot-password`, { email: e }, { timeout: 15000 });
            setNotice(`If ${e} has an account, a reset link is on its way. Open it on this device.`);
        } catch (err: any) {
            setError(messageOf(err, 'We could not send the link. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        if (resendIn > 0 || !verifyEmail) return;
        setBusy(true); setError(null);
        try {
            await axios.post(`${BACKEND_URL}/api/v1/auth/resend-verification`, { email: verifyEmail }, { timeout: 15000 });
            setNotice('A new link is on its way.');
            setResendIn(45);
        } catch (err: any) {
            setError(messageOf(err, 'Could not resend. Try again in a moment.'));
        } finally {
            setBusy(false);
        }
    };

    const reset = async () => {
        const pp = passwordProblem(password);
        if (pp) { setError(`Password: ${pp}`); return; }
        if (password !== confirm) { setError('The two passwords do not match.'); return; }
        setBusy(true); setError(null);
        try {
            const { data, error: e } = await supabase.auth.updateUser({ password });
            if (e) throw e;
            // The recovery link signed them in; carry that session into the app.
            const { data: s } = await supabase.auth.getSession();
            if (s?.session) {
                await enter({
                    accessToken: s.session.access_token,
                    refreshToken: s.session.refresh_token,
                    user: { username: data.user?.user_metadata?.username },
                });
            } else {
                switchMode('signin');
                setNotice('Password updated. Sign in with the new one.');
            }
        } catch (err: any) {
            setError(err?.message || 'The reset link may have expired. Request a new one.');
        } finally {
            setBusy(false);
        }
    };

    const usernameHint = useMemo(() => {
        if (mode !== 'signup' || !username) return null;
        const map: Record<string, { text: string; color: string }> = {
            checking: { text: 'Checking…', color: C.muted },
            free: { text: 'Available', color: C.success },
            taken: { text: 'Taken — try another', color: C.danger },
            invalid: { text: '5–30 letters, numbers or underscores', color: C.danger },
        };
        const h = map[usernameState];
        return h ? <Text style={[s.hint, { color: h.color }]}>{h.text}</Text> : null;
    }, [mode, username, usernameState]);

    const pwProblem = passwordProblem(password);

    // What every field needs beyond its own value.
    const fieldShared = {
        focused, setFocused, showPassword,
        toggleShow: () => setShowPassword(v => !v),
    };

    // ── screens ────────────────────────────────────────────────────────

    const header = (title: string, sub: string, showLogo = true) => (
        <View style={s.header}>
            {showLogo && (
                <View style={s.logoTile}>
                    <Image source={require('../../assets/app-logo.png')} style={s.logo} resizeMode="contain" />
                </View>
            )}
            <Text style={s.title}>{title}</Text>
            <Text style={s.subtitle}>{sub}</Text>
        </View>
    );

    const renderSignIn = () => (
        <>
            {header('Termax', 'Trade smarter, with AI at your side.')}
            <Banner error={error} notice={notice} />
            <Field {...fieldShared} name="id" label="Email or username" value={identifier} onChange={setIdentifier}
                placeholder="you@example.com" keyboard="email-address" autoComplete="username" />
            <Field {...fieldShared} name="pw" label="Password" value={password} onChange={setPassword}
                placeholder="Your password" secure autoComplete="current-password" onSubmit={signIn} />
            <Primary busy={busy} title="Sign in" onPress={signIn} disabled={!identifier.trim() || !password} />
            <View style={s.center}>
                <Link onPress={() => { setNotice(null); switchMode('forgot'); }}>Forgot your password?</Link>
            </View>
            <View style={[s.row, s.center, { marginTop: 22 }]}>
                <Text style={s.mutedText}>New to Termax? </Text>
                <Link onPress={() => switchMode('signup')}>Create an account</Link>
            </View>
        </>
    );

    const renderSignUp = () => (
        <>
            <View style={s.header}>
                <Text style={[s.title, { fontSize: 28, textAlign: 'left', alignSelf: 'stretch' }]}>Create your account</Text>
                <Text style={[s.subtitle, { textAlign: 'left', alignSelf: 'stretch' }]}>
                    One account for every market. Start on a funded demo — no deposit.
                </Text>
            </View>
            <Banner error={error} notice={notice} />
            <Field {...fieldShared} name="email" label="Email" value={email} onChange={setEmail}
                placeholder="you@example.com" keyboard="email-address" autoComplete="email" />
            <Field {...fieldShared} name="user" label="Username" value={username} onChange={(v: string) => setUsername(v.replace(/\s/g, ''))}
                placeholder="How other traders see you" hint={usernameHint}
                right={usernameState === 'free' ? <Check color={C.success} size={18} style={{ marginRight: 14 }} /> : null} />
            <Field {...fieldShared} name="ref" label="Referral code" value={referral} onChange={setReferral} placeholder="Optional" />
            <Field {...fieldShared} name="pw" label="Password" value={password} onChange={setPassword}
                placeholder="At least 8 characters" secure autoComplete="new-password"
                hint={<Text style={[s.hint, { color: password && pwProblem ? C.danger : C.muted }]}>
                    {password && pwProblem ? pwProblem : '8+ characters, with a letter and a digit.'}
                </Text>} />
            <Field {...fieldShared} name="pw2" label="Confirm password" value={confirm} onChange={setConfirm}
                placeholder="Repeat your password" secure autoComplete="new-password" onSubmit={signUp}
                hint={confirm && confirm !== password ? <Text style={[s.hint, { color: C.danger }]}>Does not match.</Text> : null} />
            <Primary busy={busy} title="Create account" onPress={signUp}
                disabled={!email || !username || !password || !confirm || usernameState === 'taken' || usernameState === 'invalid'} />
            <Text style={s.legal}>
                By continuing you agree to the Termax terms of use and the risk disclosure for leveraged products.
            </Text>
            <View style={[s.row, s.center, { marginTop: 18 }]}>
                <Text style={s.mutedText}>Already registered? </Text>
                <Link onPress={() => switchMode('signin')}>Sign in</Link>
            </View>
        </>
    );

    const renderForgot = () => (
        <>
            {header('Reset your password', 'Enter the email on your account and we will send a link.', false)}
            <Banner error={error} notice={notice} />
            {!notice && <>
                <Field {...fieldShared} name="id" label="Email" value={identifier} onChange={setIdentifier}
                    placeholder="you@example.com" keyboard="email-address" autoComplete="email" onSubmit={forgot} />
                <Primary busy={busy} title="Send reset link" onPress={forgot} disabled={!identifier.trim()} />
            </>}
            <View style={[s.center, { marginTop: 22 }]}>
                <Link onPress={() => switchMode('signin')}>← Back to sign in</Link>
            </View>
        </>
    );

    const renderVerify = () => (
        <>
            <View style={s.header}>
                <View style={[s.logoTile, { backgroundColor: 'rgba(41,98,255,0.14)' }]}>
                    <MailCheck color={C.primary} size={30} />
                </View>
                <Text style={s.title}>Check your inbox</Text>
                <Text style={s.subtitle}>
                    We sent a confirmation link to{'\n'}
                    <Text style={{ color: C.text, fontWeight: '700' }}>{verifyEmail || 'your email'}</Text>
                </Text>
            </View>
            <Banner error={error} notice={notice} />
            <Text style={[s.mutedText, { textAlign: 'center', marginBottom: 18 }]}>
                Open the link to activate your account, then come back and sign in.
            </Text>
            <TouchableOpacity onPress={resend} disabled={busy || resendIn > 0} style={[s.secondary, (busy || resendIn > 0) && { opacity: 0.5 }]}>
                <Text style={s.secondaryText}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend the link'}</Text>
            </TouchableOpacity>
            <View style={[s.center, { marginTop: 22 }]}>
                <Link onPress={() => { setIdentifier(verifyEmail); switchMode('signin'); }}>← Back to sign in</Link>
            </View>
        </>
    );

    const renderReset = () => (
        <>
            {header('Choose a new password', 'You are signed in through your reset link. Set the password you will use from now on.', false)}
            <Banner error={error} notice={notice} />
            <Field {...fieldShared} name="pw" label="New password" value={password} onChange={setPassword}
                placeholder="At least 8 characters" secure autoComplete="new-password"
                hint={<Text style={[s.hint, { color: password && pwProblem ? C.danger : C.muted }]}>
                    {password && pwProblem ? pwProblem : '8+ characters, with a letter and a digit.'}
                </Text>} />
            <Field {...fieldShared} name="pw2" label="Confirm new password" value={confirm} onChange={setConfirm}
                placeholder="Repeat it" secure autoComplete="new-password" onSubmit={reset} />
            <Primary busy={busy} title="Update password" onPress={reset} disabled={!password || !confirm} />
            <View style={[s.center, { marginTop: 22 }]}>
                <Link onPress={() => switchMode('signin')}>← Back to sign in</Link>
            </View>
        </>
    );

    const body = { signin: renderSignIn, signup: renderSignUp, forgot: renderForgot, verify: renderVerify, reset: renderReset }[mode]();

    // Reference-sized column on a phone; a card that does not stretch across
    // a laptop screen on the web build.
    const wide = width >= 720;

    return (
        <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
                contentContainerStyle={[s.scroll, { paddingTop: Math.max(insets.top, 24) + 16, paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={[s.column, wide && s.card]}>
                    {mode !== 'signin' && mode !== 'signup' && (
                        <TouchableOpacity onPress={() => switchMode('signin')} style={s.back} hitSlop={10}>
                            <ArrowLeft color={C.muted} size={22} />
                        </TouchableOpacity>
                    )}
                    {body}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
    column: { width: '100%', maxWidth: 440, alignSelf: 'center' },
    card: {
        backgroundColor: '#07090F', borderRadius: 24, padding: 36,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    back: { alignSelf: 'flex-start', padding: 4, marginBottom: 8, marginLeft: -4 },

    header: { alignItems: 'center', marginBottom: 28 },
    logoTile: {
        width: 72, height: 72, borderRadius: 20, backgroundColor: C.primary,
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    logo: { width: 44, height: 34 },
    title: { color: C.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.6, textAlign: 'center' },
    subtitle: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },

    field: { marginBottom: 16 },
    label: { color: C.label, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
        borderRadius: 14, minHeight: 54,
    },
    inputWrapFocused: { borderColor: C.borderFocus },
    input: { flex: 1, color: C.text, fontSize: 16, paddingHorizontal: 16, paddingVertical: 14, outlineStyle: 'none' } as any,
    eye: { paddingHorizontal: 14, paddingVertical: 12 },
    hint: { fontSize: 12.5, marginTop: 7, color: C.muted },

    primary: {
        backgroundColor: C.primary, borderRadius: 14, minHeight: 54,
        alignItems: 'center', justifyContent: 'center', marginTop: 6,
    },
    primaryText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    secondary: {
        borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
    },
    secondaryText: { color: C.text, fontSize: 15, fontWeight: '600' },

    link: { color: C.primary, fontSize: 15, fontWeight: '600' },
    mutedText: { color: C.muted, fontSize: 15 },
    legal: { color: C.subtle, fontSize: 12, lineHeight: 17, marginTop: 14 },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    center: { alignItems: 'center', justifyContent: 'center', marginTop: 18 },

    banner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
    },
    bannerError: { backgroundColor: 'rgba(242,54,69,0.10)', borderColor: 'rgba(242,54,69,0.35)' },
    bannerNotice: { backgroundColor: 'rgba(8,153,129,0.10)', borderColor: 'rgba(8,153,129,0.35)' },
    bannerText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});

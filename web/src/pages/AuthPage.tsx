/**
 * Sign in / sign up / forgot password / verify — the same flow and rules
 * as the app's AuthScreen: 8+ character password with a letter and a
 * digit, verification only when the server says it is on.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth, type MfaFactor } from '../auth';
import { Field } from '../components/ui';

type Mode = 'signin' | 'signup' | 'forgot' | 'verify' | 'sent' | 'mfa';

const passwordProblem = (p: string) => {
    if (p.length < 8) return 'Use at least 8 characters.';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one digit.';
    return null;
};

export function AuthPage() {
    const { signIn, completeMfa, signUp, config, expiredNotice, clearExpiredNotice, user, ready } = useAuth();
    const nav = useNavigate();
    const [mode, setMode] = useState<Mode>('signin');
    const [identifier, setIdentifier] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [factors, setFactors] = useState<MfaFactor[]>([]);
    const [code, setCode] = useState('');

    useEffect(() => { if (ready && user) nav('/', { replace: true }); }, [ready, user, nav]);
    useEffect(() => { if (expiredNotice) { setNotice(expiredNotice); clearExpiredNotice(); } }, [expiredNotice, clearExpiredNotice]);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true); setError(null);
        try { await fn(); } catch (e: any) { setError(e?.message || 'Something went wrong.'); } finally { setBusy(false); }
    };

    const doSignIn = () => run(async () => {
        if (!identifier.trim() || !password) throw new Error('Enter your email or username and your password.');
        const r = await signIn(identifier.trim(), password);
        if (r.ok) return;
        if ('mfaRequired' in r) { setFactors(r.factors); setCode(''); setMode('mfa'); return; }
        setEmail(r.email.includes('@') ? r.email : '');
        setMode('verify');
    });

    const doSignUp = () => run(async () => {
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username: 3–20 letters, digits or underscores.');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
        const pw = passwordProblem(password);
        if (pw) throw new Error(pw);
        const r = await signUp(username.trim(), email.trim().toLowerCase(), password);
        if ('needsVerification' in r && r.needsVerification) setMode('verify');
    });

    const doMfa = () => run(async () => {
        const clean = code.replace(/\s+/g, '');
        if (!/^\d{6,8}$/.test(clean)) throw new Error('Enter the 6-digit code from your authenticator app.');
        const factorId = factors[0]?.id;
        if (!factorId) throw new Error('No authenticator is registered on this account.');
        await completeMfa(factorId, clean);
    });

    const doForgot = () => run(async () => {
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter the email address of your account.');
        await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim().toLowerCase() }, anonymous: true });
        setMode('sent');
    });

    const resend = () => run(async () => {
        if (!email) throw new Error('Enter your email address.');
        await api('/auth/resend-verification', { method: 'POST', body: { email: email.trim().toLowerCase() }, anonymous: true });
        setNotice('Verification email sent. Check your inbox.');
    });

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'signin') doSignIn();
        else if (mode === 'signup') doSignUp();
        else if (mode === 'mfa') doMfa();
        else if (mode === 'forgot') doForgot();
        else if (mode === 'verify') resend();
    };

    const title = mode === 'mfa' ? 'Two-factor authentication' : mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : mode === 'verify' ? 'Verify your email' : 'Check your inbox';
    const sub = mode === 'mfa' ? `Enter the 6-digit code from your authenticator app${factors[0]?.friendlyName ? ` (${factors[0].friendlyName})` : ''}` : mode === 'signin' ? 'Sign in to your Termax terminal' : mode === 'signup' ? (config.requireEmailVerification ? 'We will send a verification link to your email' : 'Free access to charts, trading, bots and MaxAI') : mode === 'forgot' ? 'We will email you a link to set a new password' : mode === 'verify' ? `We sent a link to ${email || 'your email'}. Open it, then sign in.` : `A reset link is on its way to ${email}.`;

    return (
        <div className="auth">
            <div className="box">
                <div className="logo"><img src="/logo.png" alt="Termax" /></div>
                <h1>{title}</h1>
                <p className="sub">{sub}</p>
                {notice && <div className="note ok" style={{ marginBottom: 14 }}>{notice}</div>}
                <form onSubmit={submit}>
                    {mode === 'signin' && (
                        <>
                            <Field label="Email or username"><div className="inp"><input value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" autoFocus /></div></Field>
                            <Field label="Password"><div className="inp"><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></div></Field>
                            <div className="between"><span /><button type="button" onClick={() => { setMode('forgot'); setError(null); }}>Forgot password?</button></div>
                        </>
                    )}
                    {mode === 'signup' && (
                        <>
                            <Field label="Username"><div className="inp"><input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus /></div></Field>
                            <Field label="Email"><div className="inp"><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div></Field>
                            <Field label="Password" hint="At least 8 characters with a letter and a digit"><div className="inp"><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></div></Field>
                        </>
                    )}
                    {mode === 'mfa' && (
                        <Field label="Authentication code">
                            <div className="inp"><input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={8} autoFocus style={{ letterSpacing: 6, fontSize: 18, textAlign: 'center' }} placeholder="000000" /></div>
                        </Field>
                    )}
                    {(mode === 'forgot' || mode === 'verify') && (
                        <Field label="Email"><div className="inp"><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus /></div></Field>
                    )}
                    {error && <div className="note err">{error}</div>}
                    {mode !== 'sent' && (
                        <button className="btn primary block" disabled={busy} type="submit">
                            {busy ? <span className="spinner" /> : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'mfa' ? 'Verify and sign in' : 'Resend verification email'}
                        </button>
                    )}
                </form>
                <div className="foot">
                    {mode === 'signin' && <>New to Termax? <button onClick={() => { setMode('signup'); setError(null); }}>Create an account</button></>}
                    {mode !== 'signin' && <button onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>Back to sign in</button>}
                </div>
            </div>
        </div>
    );
}

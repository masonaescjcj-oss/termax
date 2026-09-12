/**
 * Two-factor authentication in Settings: scan, confirm, done — and the
 * way back out. Enrolment is not finished until a code is accepted, so an
 * abandoned attempt leaves nothing behind that could lock the trader out.
 */
import { useState } from 'react';
import { api, data } from '../api';
import { useAuth } from '../auth';
import { Field, Spinner, useLoader, useToast, when } from './ui';

interface Factor { id: string; friendlyName: string | null; factorType: string; status: string; createdAt: string | null }
interface Enrolment { id: string; qrCode: string | null; secret: string | null; uri: string | null }

export function TwoFactorCard() {
    const toast = useToast();
    const { completeMfa } = useAuth();
    const state = useLoader<{ factors: Factor[]; enabled: boolean }>(() => data('/auth/mfa'), []);
    const [pending, setPending] = useState<Enrolment | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const verified = (state.data?.factors ?? []).filter(f => f.status === 'verified');
    const enabled = verified.length > 0;

    const start = async () => {
        setBusy(true); setErr(null);
        try {
            setPending(await data<Enrolment>('/auth/mfa/enroll', { method: 'POST', body: { friendlyName: 'Authenticator app' } }));
            setCode('');
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };

    const confirm = async () => {
        if (!pending) return;
        setBusy(true); setErr(null);
        try {
            // The same verify call that completes a sign-in; it also hands
            // back the promoted session, so this tab stays signed in.
            await completeMfa(pending.id, code.replace(/\s+/g, ''));
            toast('Two-factor authentication is on. Keep a backup of your authenticator.', 'ok');
            setPending(null);
            state.reload();
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };

    const disable = async (factor: Factor) => {
        if (!window.confirm('Turn off two-factor authentication? Your account will be protected by the password alone.')) return;
        setBusy(true);
        try {
            await api(`/auth/mfa/${factor.id}`, { method: 'DELETE' });
            toast('Two-factor authentication is off', 'ok');
            state.reload();
        } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
    };

    return (
        <div className="card" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0 }}>Two-factor authentication</h3>
                <span className={`chip ${enabled ? 'green' : ''}`}>{enabled ? 'On' : 'Off'}</span>
            </div>
            <div className="sub" style={{ marginTop: 4 }}>
                A code from your phone on top of your password. With it on, a stolen password is not enough to reach your account or your trades.
            </div>

            {state.loading && !state.data ? <div style={{ marginTop: 12 }}><Spinner dark /></div> : (
                <>
                    {enabled && !pending && (
                        <>
                            {verified.map(f => (
                                <div key={f.id} className="alert-row" style={{ padding: '10px 0' }}>
                                    <div><b>{f.friendlyName || 'Authenticator app'}</b><div className="muted small">Added {when(f.createdAt)}</div></div>
                                    <button className="link-btn red" disabled={busy} onClick={() => disable(f)}>Turn off</button>
                                </div>
                            ))}
                        </>
                    )}

                    {!enabled && !pending && (
                        <button className="btn primary sm" style={{ marginTop: 12 }} disabled={busy} onClick={start}>{busy ? <Spinner /> : 'Set up two-factor'}</button>
                    )}

                    {pending && (
                        <div style={{ marginTop: 14 }}>
                            <div className="row" style={{ gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <div className="qr">
                                    {pending.qrCode
                                        ? (pending.qrCode.trim().startsWith('<svg')
                                            ? <span dangerouslySetInnerHTML={{ __html: pending.qrCode }} />
                                            : <img src={pending.qrCode} alt="Scan this with your authenticator app" />)
                                        : <span className="muted small">No QR image — use the key below.</span>}
                                </div>
                                <div style={{ flex: 1, minWidth: 220 }}>
                                    <div className="muted small">1. Scan the code with Google Authenticator, 1Password, Authy or any TOTP app.</div>
                                    {pending.secret && (
                                        <div style={{ marginTop: 8 }}>
                                            <div className="muted small">Or type this key in by hand:</div>
                                            <code className="secret">{pending.secret}</code>
                                        </div>
                                    )}
                                    <div className="muted small" style={{ marginTop: 10 }}>2. Enter the 6-digit code it shows.</div>
                                    <div style={{ marginTop: 6 }}>
                                        <Field label="" error={err}>
                                            <div className="inp"><input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" maxLength={8} placeholder="000000" style={{ letterSpacing: 5, textAlign: 'center' }} /></div>
                                        </Field>
                                    </div>
                                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                                        <button className="btn primary sm" disabled={busy || code.replace(/\s+/g, '').length < 6} onClick={confirm}>{busy ? <Spinner /> : 'Confirm'}</button>
                                        <button className="btn ghost sm" disabled={busy} onClick={() => { setPending(null); setErr(null); }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {err && !pending && <div className="note err" style={{ marginTop: 10 }}>{err}</div>}
                    {state.error && !state.data && <div className="note err" style={{ marginTop: 10 }}>{state.error}</div>}
                </>
            )}
        </div>
    );
}

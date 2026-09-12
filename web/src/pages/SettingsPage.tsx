import { useState } from 'react';
import { api } from '../api';
import { primaryAccount, useAuth } from '../auth';
import { money, useToast } from '../components/ui';
import { TwoFactorCard } from '../components/TwoFactor';

export function SettingsPage() {
    const { user, updateMe, signOut, refresh } = useAuth();
    const toast = useToast();
    const acc = primaryAccount(user);
    const [busy, setBusy] = useState(false);
    const s = user?.settings ?? {};

    const setSetting = async (patch: Record<string, any>) => {
        try { await updateMe({ settings: { ...s, ...patch } }); } catch (e: any) { toast(e.message, 'err'); }
    };
    const resetPassword = async () => {
        if (!user?.email) return;
        setBusy(true);
        try { await api('/auth/forgot-password', { method: 'POST', body: { email: user.email } }); toast(`Reset link sent to ${user.email}`, 'ok'); }
        catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
    };
    const deactivate = async () => {
        if (!window.confirm('Delete your Termax account? This cannot be undone.')) return;
        try { await api('/auth/deactivate', { method: 'POST' }); signOut(); } catch (e: any) { toast(e.message, 'err'); }
    };

    return (
        <div className="page"><div className="page-inner" style={{ maxWidth: 760 }}>
            <div className="page-head"><div><h1>Settings</h1><p>Your account, trading account and preferences.</p></div></div>
            <div className="card">
                <h3>Profile</h3>
                <div className="kv-list" style={{ padding: 0 }}>
                    <div><span>Username</span><b>{user?.username}</b></div>
                    <div><span>Email</span><b>{user?.email}</b></div>
                    <div><span>Plan</span><b>{user?.plan || 'PRO'} <span className="chip green" style={{ marginLeft: 6 }}>free access</span></b></div>
                    {user?.referralCode && <div><span>Referral code</span><b className="mono">{user.referralCode}</b></div>}
                </div>
                <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn ghost sm" disabled={busy} onClick={resetPassword}>Change password</button>
                    <button className="btn ghost sm" onClick={() => refresh().then(() => toast('Profile refreshed', 'ok')).catch(() => {})}>Refresh</button>
                </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
                <h3>Trading account</h3>
                {!acc ? <div className="muted">A demo account is created on your first order.</div> : (
                    <div className="kv-list" style={{ padding: 0 }}>
                        <div><span>Type</span><b>{acc.accountType}</b></div>
                        <div><span>Broker</span><b>{acc.broker || 'Termax simulated'}</b></div>
                        <div><span>Balance</span><b>{money(acc.balance)} {acc.currency}</b></div>
                        <div><span>Leverage</span><b>{acc.leverage || '1:100'}</b></div>
                    </div>
                )}
            </div>
            <TwoFactorCard />
            <div className="card" style={{ marginTop: 16 }}>
                <h3>Preferences</h3>
                <label className="row" style={{ gap: 8, padding: '8px 0', cursor: 'pointer' }}><input type="checkbox" checked={s.notifications !== false} onChange={e => setSetting({ notifications: e.target.checked })} /> Notifications for fills, stops and bot events</label>
                <label className="row" style={{ gap: 8, padding: '8px 0', cursor: 'pointer' }}><input type="checkbox" checked={!!s.confirmOrders} onChange={e => setSetting({ confirmOrders: e.target.checked })} /> Ask for confirmation before every order</label>
            </div>
            <div className="card" style={{ marginTop: 16, borderColor: 'rgba(242,54,69,0.35)' }}>
                <h3>Danger zone</h3>
                <div className="sub">Deleting your account removes access immediately. Trade history is anonymised.</div>
                <button className="btn danger sm" style={{ marginTop: 10 }} onClick={deactivate}>Delete account</button>
            </div>
        </div></div>
    );
}

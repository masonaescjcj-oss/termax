import { useState } from 'react';
import { useAuth } from '../auth';

export default function Login() {
    const { signIn, expiredNotice } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await signIn(identifier.trim(), password);
        } catch (err: any) {
            setError(err?.message || 'Could not sign in.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="login-page">
            <form className="card login-card" onSubmit={submit}>
                <div className="brand">
                    <span className="dot" />
                    <span>Termax<small>ADMIN CONSOLE</small></span>
                </div>

                {expiredNotice && !error && <div className="notice warn">{expiredNotice}</div>}
                {error && <div className="notice error">{error}</div>}

                <label className="field">
                    <span>Email or username</span>
                    <input
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        autoComplete="username"
                        autoFocus
                    />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                    />
                </label>

                <button className="primary" style={{ width: '100%' }} disabled={busy || !identifier || !password}>
                    {busy ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="muted" style={{ fontSize: 12, marginBottom: 0, marginTop: 14, textAlign: 'center' }}>
                    Admin accounts only. This console is separate from the Termax app.
                </p>
            </form>
        </div>
    );
}

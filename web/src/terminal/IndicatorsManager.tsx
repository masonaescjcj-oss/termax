/**
 * Manage the trader's own indicators: create an expression, switch them
 * on and off for the chart, delete. Code (PRO) indicators are listed and
 * toggled here too; writing code stays in the app's AI Studio.
 */
import { useState } from 'react';
import { Field, Modal, Spinner, useLoader, useToast } from '../components/ui';
import { createIndicator, deleteIndicator, EXPR_EXAMPLES, EXPR_HELP, listIndicators, toggleIndicator, type CustomIndicator } from './customIndicators';

const COLORS = ['#ff9800', '#2962ff', '#e91e63', '#00bcd4', '#8bc34a', '#ab47bc', '#ffee58', '#f0f3fa'];

export function IndicatorsManager({ onClose, onChanged }: { onClose: () => void; onChanged: (list: CustomIndicator[]) => void }) {
    const toast = useToast();
    const list = useLoader<CustomIndicator[]>(() => listIndicators(), []);
    const [name, setName] = useState('');
    const [expr, setExpr] = useState('');
    const [pane, setPane] = useState<'price' | 'separate'>('separate');
    const [color, setColor] = useState(COLORS[0]);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const refresh = async () => { const rows = await listIndicators(); list.setData(rows); onChanged(rows); };

    const create = async () => {
        setBusy(true); setErr(null);
        try {
            await createIndicator({ name: name.trim(), expr: expr.trim(), kind: 'EXPR', pane, color });
            toast(`Indicator "${name.trim()}" created and switched on`, 'ok');
            setName(''); setExpr('');
            await refresh();
        } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
    };
    const toggle = async (ind: CustomIndicator) => {
        try { await toggleIndicator(ind.id, !ind.enabled); await refresh(); } catch (e: any) { toast(e.message, 'err'); }
    };
    const remove = async (ind: CustomIndicator) => {
        if (!window.confirm(`Delete "${ind.name}"?`)) return;
        try { await deleteIndicator(ind.id); await refresh(); } catch (e: any) { toast(e.message, 'err'); }
    };

    return (
        <Modal title="My indicators" onClose={onClose} wide>
            <div className="two" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                    <div className="section-title" style={{ padding: '0 0 6px' }}>Saved</div>
                    {list.loading && !list.data ? <Spinner dark /> : !list.data?.length ? <div className="muted small">No indicators yet — write one on the right.</div> : list.data.map(ind => (
                        <div key={ind.id} className="alert-row" style={{ padding: '8px 0' }}>
                            <label className="row" style={{ gap: 8, cursor: 'pointer', minWidth: 0 }}>
                                <input type="checkbox" checked={ind.enabled} onChange={() => toggle(ind)} />
                                <span style={{ width: 10, height: 10, borderRadius: 5, background: ind.color, flex: '0 0 auto' }} />
                                <span className="ellipsis"><b>{ind.name}</b> <span className="muted small">· {ind.kind === 'CODE' ? 'code' : ind.expr} · {ind.pane === 'price' ? 'on price' : 'own pane'}</span></span>
                            </label>
                            <button className="link-btn red" onClick={() => remove(ind)}>Delete</button>
                        </div>
                    ))}
                </div>
                <div>
                    <div className="section-title" style={{ padding: '0 0 6px' }}>New expression indicator</div>
                    <Field label="Name"><div className="inp"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Distance to EMA20" /></div></Field>
                    <div style={{ marginTop: 8 }}>
                        <Field label="Expression" hint="Evaluated on the server for every bar. It cannot loop or escape — by construction.">
                            <textarea className="box mono" style={{ minHeight: 64 }} value={expr} onChange={e => setExpr(e.target.value)} placeholder="(close - EMA(close, 20)) / ATR(14) * 100" />
                        </Field>
                    </div>
                    <div className="row" style={{ gap: 10, marginTop: 8 }}>
                        <div className="seg ticket" style={{ padding: 0, flexDirection: 'row', flex: 1 }}>
                            <button className={pane === 'separate' ? 'active' : ''} style={{ flex: 1, height: 30, fontSize: 12, fontWeight: 600, color: pane === 'separate' ? 'var(--text-strong)' : 'var(--muted)', background: pane === 'separate' ? 'var(--panel-3)' : 'transparent' }} onClick={() => setPane('separate')}>Own pane</button>
                            <button className={pane === 'price' ? 'active' : ''} style={{ flex: 1, height: 30, fontSize: 12, fontWeight: 600, color: pane === 'price' ? 'var(--text-strong)' : 'var(--muted)', background: pane === 'price' ? 'var(--panel-3)' : 'transparent' }} onClick={() => setPane('price')}>On price</button>
                        </div>
                        <div className="row" style={{ gap: 4 }}>{COLORS.map(c => <button key={c} onClick={() => setColor(c)} style={{ width: 18, height: 18, borderRadius: 9, background: c, border: c === color ? '2px solid #fff' : '2px solid transparent' }} aria-label={c} />)}</div>
                    </div>
                    {err && <div className="note err" style={{ marginTop: 8 }}>{err}</div>}
                    <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy || name.trim().length < 2 || !expr.trim()} onClick={create}>{busy ? <Spinner /> : 'Create'}</button>
                    <div className="section-title" style={{ padding: '14px 0 4px' }}>Cheat sheet</div>
                    <table className="grid small"><tbody>{EXPR_HELP.map(([k, v]) => <tr key={k}><td className="mono" style={{ padding: '3px 6px 3px 0', borderBottom: 0 }}>{k}</td><td className="muted" style={{ padding: '3px 0', borderBottom: 0 }}>{v}</td></tr>)}</tbody></table>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{EXPR_EXAMPLES.map(ex => <button key={ex.expr} className="chip-btn ghost" onClick={() => { setName(ex.name); setExpr(ex.expr); }}>{ex.name}</button>)}</div>
                </div>
            </div>
        </Modal>
    );
}

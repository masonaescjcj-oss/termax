import React from 'react';
import { Ic } from '../components/icons';
import type { DrawTool } from './Chart';

const TOOLS: Array<{ id: DrawTool; label: string; icon: () => React.JSX.Element }> = [
    { id: 'cursor', label: 'Cross (Esc)', icon: Ic.cursor },
    { id: 'segment', label: 'Trend line', icon: Ic.trend },
    { id: 'rayLine', label: 'Ray', icon: Ic.ray },
    { id: 'straightLine', label: 'Extended line', icon: Ic.line },
    { id: 'horizontalStraightLine', label: 'Horizontal line', icon: Ic.hline },
    { id: 'verticalStraightLine', label: 'Vertical line', icon: Ic.vline },
    { id: 'priceLine', label: 'Price level', icon: Ic.price },
    { id: 'priceChannelLine', label: 'Parallel channel', icon: Ic.channel },
    { id: 'fibonacciLine', label: 'Fibonacci retracement', icon: Ic.fib },
    { id: 'rect', label: 'Rectangle', icon: Ic.layout },
    { id: 'simpleAnnotation', label: 'Annotation', icon: Ic.text },
    { id: 'simpleTag', label: 'Tag', icon: Ic.tag },
];

export function LeftRail({ tool, onTool, onUndo, onClear, locked, hidden, onLock, onHide }: {
    tool: DrawTool; onTool: (t: DrawTool) => void; onUndo: () => void; onClear: () => void;
    locked: boolean; hidden: boolean; onLock: () => void; onHide: () => void;
}) {
    return (
        <aside className="rail" aria-label="Drawing tools">
            {TOOLS.map((t, i) => (
                <React.Fragment key={t.id}>
                    {i === 1 && <span className="rail-sep" />}
                    <button className={`rail-btn ${tool === t.id ? 'active' : ''}`} title={t.label} onClick={() => onTool(t.id)}><t.icon /></button>
                </React.Fragment>
            ))}
            <span className="rail-sep" />
            <button className={`rail-btn ${locked ? 'active' : ''}`} title={locked ? 'Unlock drawings' : 'Lock drawings'} onClick={onLock}><Ic.lock /></button>
            <button className={`rail-btn ${hidden ? 'active' : ''}`} title={hidden ? 'Show drawings' : 'Hide drawings'} onClick={onHide}><Ic.eye /></button>
            <button className="rail-btn" title="Remove last drawing" onClick={onUndo}><Ic.eraser /></button>
            <button className="rail-btn" title="Remove all drawings" onClick={onClear}><Ic.trash /></button>
        </aside>
    );
}

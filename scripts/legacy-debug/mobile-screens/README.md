# Dead PositionsScreen snapshots

These are older build/backup copies of `mobile/src/screens/PositionsScreen`.
Nothing imports them — they were verified unreferenced before being moved here
out of `mobile/src/`.

They are kept only for reference. **Do not copy calculation code out of them:**
they contain the original `pnlMultipliers` tables that had no forex pairs, so
every forex lookup fell through to a multiplier of 1 and produced a P/L
100,000x too small. Position maths now lives in
`mobile/src/lib/positionMath.ts`, driven by the contract terms the server
sends with each position.

`PositionsScreen_compiled.js` and `PositionsScreen_clean.js` are byte-identical.

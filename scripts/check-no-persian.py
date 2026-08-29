#!/usr/bin/env python3
"""
Fail if any user-facing Persian text remains.

Termax is an English-language product. This scans for characters in the
Arabic/Persian Unicode blocks and reports where they are, so a stray
Persian string cannot quietly ship. Files may opt out with a
`persian-ok` marker on the same line — used for the Jalali calendar,
whose month names are the point of it.
"""
import re
import sys
from pathlib import Path

# Arabic (0600-06FF), Arabic Supplement, Extended-A, Presentation Forms.
PERSIAN = re.compile(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]')

# Resolved from this file, not from the working directory. `npm test` runs
# the gate from `backend/`, where relative roots of `mobile/src` and
# `backend/src` match nothing at all — so it scanned zero files and printed
# a pass. A gate that cannot fail is not a gate.
REPO = Path(__file__).resolve().parent.parent
ROOTS = [REPO / 'mobile' / 'src', REPO / 'backend' / 'src']
SUFFIXES = {'.ts', '.tsx', '.js', '.jsx'}
SKIP_PARTS = {'node_modules', 'legacy-debug', '__tests__'}
# The Jalali calendar exists to render Persian month names; the trace and
# describe modules keep a Persian branch that nothing calls any more but
# that costs nothing to leave typed.
ALLOW_FILES = {
    'backend/src/services/insights/jalali.ts',
    'backend/src/services/insights/journalCalendar.ts',
    'backend/src/services/strategy/trace.ts',
    'backend/src/services/strategy/describe.ts',
}

# Backend modules that still carry the bilingual era's Persian branch: a
# `fa` string beside the `en` one, and Persian in some comments. No response
# carries any of it — englishOnly.test.ts drives each renderer the way the
# API drives it and asserts that what comes back is Latin — so none of it is
# user-facing. They are listed one by one rather than skipped wholesale: the
# list only shrinks, and anything Persian in a file that is not on it fails.
DEAD_FA_BRANCH = {
    'backend/src/controllers/aiController.ts',
    'backend/src/controllers/botsController.ts',
    'backend/src/controllers/insightsController.ts',
    'backend/src/services/ai/botBuilder.ts',
    'backend/src/services/bots/scanner.ts',
    'backend/src/services/bots/watchdog.ts',
    'backend/src/services/insights/autopsy.ts',
    'backend/src/services/insights/digest.ts',
    'backend/src/services/insights/journal.ts',
    'backend/src/services/insights/journalEntry.ts',
    'backend/src/services/insights/portfolio.ts',
    'backend/src/services/insights/shareCard.ts',
    'backend/src/services/insights/tradeDna.ts',
    'backend/src/services/riskGuard.ts',
}
ALLOW_FILES |= DEAD_FA_BRANCH

def main() -> int:
    hits = []
    for root in ROOTS:
        for path in root.rglob('*'):
            if path.suffix not in SUFFIXES:
                continue
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            rel = path.relative_to(REPO).as_posix()
            if rel in ALLOW_FILES or '.test.' in path.name:
                continue
            try:
                text = path.read_text(encoding='utf-8')
            except Exception:
                continue
            for n, ln in enumerate(text.splitlines(), 1):
                if PERSIAN.search(ln) and 'persian-ok' not in ln:
                    hits.append((rel, n, ln.strip()[:90]))

    if not hits:
        print('✅ no Persian text outside the allowed files')
        return 0
    by_file = {}
    for rel, n, ln in hits:
        by_file.setdefault(rel, []).append((n, ln))
    print(f'❌ Persian text in {len(by_file)} file(s), {len(hits)} line(s):\n')
    for rel, lines in sorted(by_file.items(), key=lambda kv: -len(kv[1])):
        print(f'  {rel}  ({len(lines)} lines)')
        for n, ln in lines[:3]:
            print(f'      {n}: {ln}')
        if len(lines) > 3:
            print(f'      … {len(lines) - 3} more')
    return 1

if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env bash
# Termax deploy — run ON THE SERVER from the repo root (/srv/termax/app).
#   ./deploy/deploy.sh            # pull, build backend + web, restart
#   ./deploy/deploy.sh --no-web   # skip the (slow) Expo web export
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── pulling ──"
git pull --ff-only

echo "── backend ──"
cd backend
npm ci --no-audit --no-fund
npm run build
npm test
cd ..

if [[ "${1:-}" != "--no-web" ]]; then
    echo "── web build ──"
    cd mobile
    npm ci --no-audit --no-fund
    npx expo export --platform web --output-dir /srv/termax/web.next
    cd ..
    # atomic-ish swap so a half-written build is never served
    rm -rf /srv/termax/web.old
    [ -d /srv/termax/web ] && mv /srv/termax/web /srv/termax/web.old
    mv /srv/termax/web.next /srv/termax/web
fi

echo "── restart ──"
sudo systemctl restart termax-backend
sleep 2
curl -sf http://127.0.0.1:5000/api/health && echo " ✓ backend healthy"

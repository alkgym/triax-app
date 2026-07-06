#!/bin/bash
# Despliegue de GYM (gym.lopezalex.app) — v2, tras inspeccionar el VPS:
#   · La app la sirve el contenedor `triathlon` (imagen horneada, build multi-stage).
#   · /opt/apps/triathlon = código fuente + Dockerfile + docker-compose.yml.
#   · /api/* → contenedor triax-sync (v2; aquí se actualiza a v3 con migración).
# Pasos: restaurar árbol del backup → sincronizar código nuevo → rebuild imagen
#        → triax-sync v3 → verificación. No borra datos de usuario en ningún paso.
set -euo pipefail

VPS="alex@62.84.178.183"
DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%F-%H%M)"
BACKUP="gym-web-2026-07-06-1132.tgz"   # backup íntegro del árbol original (hecho hoy)

echo "══ 1/6 · Backup adicional del estado actual del sync"
ssh "$VPS" "sudo cp /opt/apps/triax-sync/server.py /opt/apps/triax-sync/server.py.bak.$STAMP && sudo cp /opt/apps/triax-sync/data/sync.db /opt/apps/triax-sync/data/sync.db.bak.$STAMP && echo '   sync respaldado'"

echo "══ 2/6 · Restaurando árbol original de la app (Dockerfile + compose del backup)"
ssh "$VPS" "find /opt/apps/triathlon -mindepth 1 -delete && tar xzf ~/backups/$BACKUP -C /opt/apps/triathlon && test -f /opt/apps/triathlon/docker-compose.yml && echo '   árbol restaurado'"

echo "══ 3/6 · Sincronizando el código nuevo"
rsync -az --delete -e ssh "$DIR/src/" "$VPS:/opt/apps/triathlon/src/"
rsync -az --delete -e ssh "$DIR/public/" "$VPS:/opt/apps/triathlon/public/"
rsync -az -e ssh "$DIR/index.html" "$DIR/package.json" "$DIR/package-lock.json" \
  "$DIR/vite.config.ts" "$DIR/tsconfig.json" "$DIR/tsconfig.app.json" "$DIR/tsconfig.node.json" \
  "$DIR/tailwind.config.js" "$DIR/postcss.config.js" "$DIR/eslint.config.js" \
  "$VPS:/opt/apps/triathlon/"
echo "   código sincronizado"

echo "══ 4/6 · Rebuild de la imagen y arranque (puede tardar 2-4 min)"
ssh "$VPS" "cd /opt/apps/triathlon && docker compose up -d --build 2>&1 | tail -3"

echo "══ 5/6 · triax-sync v3 (migración sqlite con sudo; datos intactos)"
ssh "$VPS" "sudo python3 - /opt/apps/triax-sync/data/sync.db <<'PY'
import sqlite3, sys
c = sqlite3.connect(sys.argv[1])
cols = [r[1] for r in c.execute('PRAGMA table_info(history)')]
if cols:
    if 'user' not in cols:
        c.execute(\"ALTER TABLE history ADD COLUMN user TEXT NOT NULL DEFAULT 'me'\")
    if 'user_records' not in cols:
        c.execute('ALTER TABLE history ADD COLUMN user_records INTEGER NOT NULL DEFAULT 0')
c.execute('CREATE TABLE IF NOT EXISTS meta (user TEXT PRIMARY KEY, canonical_server_at INTEGER)')
c.commit()
print('   esquema migrado; versiones guardadas:', c.execute('SELECT COUNT(*) FROM history').fetchone()[0])
PY"
scp -q "$DIR/server/triax-sync/server.py" "$VPS:/tmp/triax-server.py"
ssh "$VPS" "sudo mv /tmp/triax-server.py /opt/apps/triax-sync/server.py && cd /opt/apps/triax-sync && (docker compose restart 2>/dev/null || docker restart triax-sync) >/dev/null && echo '   triax-sync v3 en marcha'"

echo "══ 6/6 · Verificación"
sleep 3
COOKIE=$(grep -om1 'alex_auth=[0-9a-f]*' ~/Desktop/APPS/ACCESS.md 2>/dev/null || true)
OLDJS="index-B6ZHLx9Q.js"   # bundle que servía antes del despliegue
LIVEJS=$(curl -s ${COOKIE:+-H "Cookie: $COOKIE"} https://gym.lopezalex.app/ | grep -om1 'index-[^"]*\.js' || true)
if [ -n "$LIVEJS" ] && [ "$LIVEJS" != "$OLDJS" ]; then
  echo "   ✓ bundle nuevo servido: $LIVEJS"
else
  echo "   ✗ OJO: se sigue sirviendo $LIVEJS (¿build fallido? mira la salida del paso 4)"
fi
curl -s -o /dev/null -w "   gym.lopezalex.app → HTTP %{http_code}\n" ${COOKIE:+-H "Cookie: $COOKIE"} https://gym.lopezalex.app/
[ -n "$COOKIE" ] && curl -sI -H "Cookie: $COOKIE" https://gym.lopezalex.app/api/snapshot | grep -i '^server' || true
echo "✓ Hecho. En el móvil: cierra la app del todo y ábrela DOS veces (el service worker coge la versión nueva al segundo arranque)."

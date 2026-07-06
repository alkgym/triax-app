#!/bin/bash
# Despliegue de GYM (gym.lopezalex.app) al VPS: app + triax-sync v3.
# Seguro: copia de seguridad de todo antes de tocar nada; NO borra datos del sync.
set -euo pipefail

VPS="alex@62.84.178.183"
DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date +%F-%H%M)"

echo "══ 1/5 · Comprobando build local"
test -f "$DIR/dist/index.html" || { echo "✗ Falta dist/ — ejecuta: cd $DIR && npm run build"; exit 1; }

echo "══ 2/5 · Localizando la app en el VPS"
WEBROOT=$(ssh "$VPS" "grep -rl 'data-fs-app=\"triathlon\"' /srv /opt/apps --include=index.html 2>/dev/null | grep -v backup | head -1 | xargs -r dirname")
[ -n "$WEBROOT" ] || { echo '✗ No encuentro el webroot de gym — aborto sin tocar nada'; exit 1; }
echo "   webroot: $WEBROOT"

echo "══ 3/5 · Backup remoto y subida de la app"
ssh "$VPS" "mkdir -p ~/backups && tar czf ~/backups/gym-web-$STAMP.tgz -C '$WEBROOT' . 2>/dev/null || sudo -n tar czf ~/backups/gym-web-$STAMP.tgz -C '$WEBROOT' ."
echo "   backup: ~/backups/gym-web-$STAMP.tgz"
if rsync -az --delete -e ssh "$DIR/dist/" "$VPS:$WEBROOT/" 2>/dev/null; then
  echo "   app subida (sin sudo)"
else
  rsync -az --delete -e ssh --rsync-path="sudo -n rsync" "$DIR/dist/" "$VPS:$WEBROOT/"
  echo "   app subida (con sudo)"
fi

echo "══ 4/5 · triax-sync v3 (migración del sqlite; datos intactos)"
if ssh "$VPS" "test -d /opt/apps/triax-sync"; then
  SYNCDIR=/opt/apps/triax-sync
  ssh "$VPS" "cp $SYNCDIR/server.py $SYNCDIR/server.py.bak.$STAMP && cp $SYNCDIR/data/sync.db $SYNCDIR/data/sync.db.bak.$STAMP && echo '   backups de sync hechos'"
  ssh "$VPS" "python3 - '$SYNCDIR/data/sync.db' <<'PY'
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
  scp -q "$DIR/server/triax-sync/server.py" "$VPS:$SYNCDIR/server.py"
  ssh "$VPS" "cd $SYNCDIR && (docker compose restart 2>/dev/null || docker restart triax-sync)" >/dev/null
  echo "   triax-sync v3 en marcha"
else
  echo "   aviso: /opt/apps/triax-sync no existe — la app funciona igual con el sync v2 actual"
fi

echo "══ 5/5 · Verificación"
sleep 2
# La cookie del gate se lee de ACCESS.md (local, fuera de git); sin ella solo se comprueba que responde.
COOKIE=$(grep -om1 'alex_auth=[0-9a-f]*' ~/Desktop/APPS/ACCESS.md 2>/dev/null || true)
curl -s -o /dev/null -w "   gym.lopezalex.app → HTTP %{http_code}\n" ${COOKIE:+-H "Cookie: $COOKIE"} https://gym.lopezalex.app/
[ -n "$COOKIE" ] && curl -sI -H "Cookie: $COOKIE" https://gym.lopezalex.app/api/snapshot | grep -i '^server' || true
echo "✓ Despliegue completado. En el móvil: cierra la app del todo y ábrela DOS veces (el service worker coge la versión nueva en el segundo arranque)."

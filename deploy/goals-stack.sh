#!/bin/bash
# Boots the whole goals-tracker stack and keeps the GitHub Pages build pointed
# at whatever URL Cloudflare hands out this time.
#
# Quick tunnels get a fresh random hostname every restart, and the frontend has
# that URL baked in at build time. So the sequence is: start the API and Vite,
# open the tunnel, then push the new base URL into the repo variable and force
# a Pages rebuild. Without that last step the site silently points at a tunnel
# that no longer exists, which looks exactly like a database problem.
set -u
APP=/home/tchizu101/Work/goals-tracker
LOG=/tmp/opencode
mkdir -p "$LOG"
URLFILE=$LOG/url.txt

log() { echo "[$(date +%H:%M:%S)] $*"; }

wait_for() {  # wait_for <port> <label> <tries>
  for _ in $(seq 1 "${3:-30}"); do
    ss -ltn 2>/dev/null | grep -q ":$1 " && { log "$2 up on $1"; return 0; }
    sleep 1
  done
  log "WARNING $2 never came up on $1"
  return 1
}

# Free the ports before starting anything. systemd only kills the cgroup it
# created, so an API started from a terminal (or a previous --watch fork) can
# survive a restart and keep port 4000. A fresh instance then dies with
# EADDRINUSE while the stale one goes on serving days-old code, which is
# exactly how an old build kept answering after the source was fixed.
free_port() {
  for _ in $(seq 1 10); do
    local pids
    pids=$(ss -ltnp 2>/dev/null | grep ":$1 " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    [ -z "$pids" ] && return 0
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null
    sleep 1
    pids=$(ss -ltnp 2>/dev/null | grep ":$1 " | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
    [ -n "$pids" ] && kill -9 $pids 2>/dev/null
    sleep 1
  done
}

free_port 4000
free_port 5173
pkill -f "server/src/index.js" 2>/dev/null

# The API and Vite are children of this unit, so systemd restarts them together.
# --watch is deliberately not used: it supervises by spawning a detached
# child that escapes this cgroup, which is how a stale process outlived the
# unit in the first place. The stack is restarted wholesale instead.
log "starting API"
cd "$APP/server" && node src/index.js >>"$LOG/api.log" 2>&1 &
wait_for 4000 API 40

log "starting Vite"
cd "$APP" && npx vite --host --port 5173 --strictPort >>"$LOG/vite.log" 2>&1 &
wait_for 5173 Vite 60

log "opening tunnel"
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 1
/tmp/opencode/cloudflared tunnel --url http://localhost:5173 --no-autoupdate \
  >"$LOG/tunnel.log" 2>&1 &

# Wait for the assigned hostname. cloudflared first logs "Requesting new quick
# Tunnel on api.trycloudflare.com...", and a loose pattern matches that literal
# api host too, so the wait used to break on the placeholder before the real
# name was ever printed. The script then probed a URL that does not exist,
# failed, and systemd restarted the stack - five of sixteen starts ended up
# this way, thrashing the tunnel and repointing Pages at dead hosts.
# Quick tunnel hostnames are always three random words joined by dashes, so
# require that shape and explicitly exclude the api host.
tunnel_url() {
  grep -oE "https://[a-z0-9]+(-[a-z0-9]+){2,}\.trycloudflare\.com" "$LOG/tunnel.log" 2>/dev/null \
    | grep -v "^https://api\." | tail -1
}

for _ in $(seq 1 45); do
  URL=$(tunnel_url)
  [ -n "$URL" ] && break
  sleep 2
done

if [ -z "${URL:-}" ]; then
  log "no tunnel URL appeared; the old one may still work, leaving it alone"
  exit 1
fi

OLD=$(cat "$URLFILE" 2>/dev/null)
echo "$URL" > "$URLFILE"
log "tunnel is $URL"

if [ "$OLD" != "$URL" ]; then
  log "URL changed from ${OLD:-none}, repointing the Pages build"
  cd "$APP" || exit 1
  if gh variable set VITE_API_URL --body "$URL/api" --repo SaadFaid/goals-tracker; then
    # An empty commit is the only way to re-trigger a workflow that keys off
    # file changes, since the variable itself lives outside the repo history.
    git commit -q --allow-empty -m "Repoint the web build at the current API tunnel

The tunnel hostname is chosen by Cloudflare and changes on every restart.
The frontend reads its API base at build time, so the repo variable moved
and this no-op commit exists only to trigger the Pages rebuild.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
    if git push -q origin master; then
      log "pushed; Pages will rebuild in about a minute"
    else
      log "push failed - site now points at a dead tunnel"
    fi
  else
    log "could not set the repo variable - site now points at a dead tunnel"
  fi
else
  log "URL unchanged, nothing to redeploy"
fi

log "ready"

# Watchdog. Exiting is the only way to get systemd to rebuild the stack, so
# this loop has to notice a dead tunnel by asking the public URL, not by
# waiting for a process to die. cloudflared does not exit when a quick tunnel
# is revoked; it logs "Tunnel not found" and retries forever, which is exactly
# what let a dead URL sit there being served to the public unnoticed.
WARMUP_FAILS=6
fails=0
while true; do
  sleep 20
  for port in 4000 5173; do
    if ! ss -ltn 2>/dev/null | grep -q ":$port "; then
      log "port $port is gone, exiting so systemd restarts the stack"
      exit 1
    fi
  done
  # Probe /api/health, never /api/auth/login. The login route is rate limited
  # and only exempts successful requests, so a bogus login counted as a failed
  # attempt: five checks exhausted the budget and locked the real user out
  # within 100 seconds. /api/health is unauthenticated and not limited.
  code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$URL/api/health" 2>/dev/null)
  if [ "$code" = "200" ]; then
    fails=0
    continue
  fi
  # A quick tunnel needs time to propagate through Cloudflare's edge before it
  # answers, and the edge itself drops the occasional request. Probing ~20s after
  # the tunnel opened and tearing the whole stack down on a single 000 turned a
  # slow edge into a restart loop: every cycle burned a new tunnel URL, a repoint
  # commit and a Pages rebuild, and the site was down more than it was up. So a
  # failure has to repeat before it counts, and a freshly opened tunnel gets a
  # grace period to come up first.
  fails=$((fails + 1))
  if [ "$fails" -lt "$WARMUP_FAILS" ]; then
    log "tunnel not answering yet ($fails/$WARMUP_FAILS, got '$code')"
    continue
  fi
  log "tunnel not serving after $fails attempts (got '$code'), exiting so systemd reopens it"
  exit 1
done

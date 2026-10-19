#!/bin/zsh
# Klik dua kali untuk menyalakan Studio Konten, lalu browser terbuka otomatis.
cd "$(dirname "$0")/studio"
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"
if ! curl -s -o /dev/null localhost:4321/api/state; then
  # Build the dashboard when it is missing or older than its sources (new pages after an update).
  if [ ! -f dist/index.html ] || [ -n "$(find web vite.config.js -newer dist/index.html -type f 2>/dev/null | head -1)" ]; then npx vite build; fi
  (sleep 2 && open http://localhost:4321) &
  npm start
else
  open http://localhost:4321
fi

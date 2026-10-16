#!/bin/sh
# Starts a local preview of your wedding website (macOS and Linux).
# macOS: first time only, open Terminal and run:  chmod +x start-local-server.command
#        then double-click this file. (Or just run: python3 -m http.server 8000)
# Needs Python 3, which is already installed on current macOS and most Linux systems.
# Press Ctrl+C or close the window to stop.
cd "$(dirname "$0")" || exit 1

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys; sys.exit(0 if sys.version_info[0] >= 3 else 1)' 2>/dev/null; then
  PY=python
else
  echo "Python 3 was not found."
  echo "Install it from https://www.python.org/downloads/ or see START-HERE.html for other ways to preview the site."
  exit 1
fi

URL="http://localhost:8000/"
echo
echo "  Your website is running at $URL"
echo "  Edit js/config.js, save, then refresh the browser. Press Ctrl+C to stop."
echo
( sleep 1; { command -v open >/dev/null 2>&1 && open "$URL"; } || { command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL"; } ) >/dev/null 2>&1 &
exec "$PY" -m http.server 8000 --bind 127.0.0.1

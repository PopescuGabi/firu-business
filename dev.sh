#!/bin/sh
# Starts the dev server with the locally installed Node.js on PATH.
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"
exec npm run dev

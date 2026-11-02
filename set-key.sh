#!/bin/sh
# Saves a secret into .env.local without showing it on screen.
# Usage: ./set-key.sh GOOGLE_CLIENT_SECRET   (or ANTHROPIC_API_KEY)
cd "$(dirname "$0")" || exit 1
case "$1" in
  GOOGLE_CLIENT_SECRET) prefix="GOCSPX-" ;;
  ANTHROPIC_API_KEY) prefix="sk-ant-" ;;
  *) echo "Usage: ./set-key.sh GOOGLE_CLIENT_SECRET | ANTHROPIC_API_KEY"; exit 1 ;;
esac
printf "Paste your %s and press Return (it stays hidden): " "$1"
stty -echo; read -r value; stty echo; echo
value=$(printf "%s" "$value" | tr -d '[:space:]"'"'")
case "$value" in
  "$prefix"*) ;;
  *) echo "That doesn't look right: it should start with $prefix. Nothing was saved."; exit 1 ;;
esac
KEY="$1" VALUE="$value" python3 -I - <<'PY'
import os, re
key, value = os.environ["KEY"], os.environ["VALUE"]
text = open(".env.local").read()
line = f"{key}={value}"
text = re.sub(rf"^{key}=.*$", lambda _: line, text, flags=re.M) if re.search(rf"^{key}=", text, re.M) else text.rstrip("\n") + f"\n{line}\n"
open(".env.local", "w").write(text)
PY
chmod 600 .env.local
echo "Saved $1 (${#value} characters)."

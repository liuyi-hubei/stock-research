#!/usr/bin/env bash
set -euo pipefail

# Run as the unprivileged stockdeploy user. The public repository needs no token.
REPO_URL='https://github.com/liuyi-hubei/stock-research.git'
STATE_DIR='/var/lib/stock-research'
CHECKOUT="$STATE_DIR/source"
WEB_ROOT='/var/www/stock-research'
DEPLOYED_COMMIT_FILE="$STATE_DIR/deployed-commit"

if [[ "$(id -un)" != 'stockdeploy' ]]; then
  echo 'Run this script as stockdeploy.' >&2
  exit 1
fi
if [[ ! -d "$STATE_DIR" || ! -d "$WEB_ROOT" || -L "$WEB_ROOT" ]]; then
  echo 'Expected state directory and real web root are missing.' >&2
  exit 1
fi

exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || exit 0

if [[ ! -d "$CHECKOUT/.git" ]]; then
  if [[ -e "$CHECKOUT" ]]; then
    echo 'Checkout path exists but is not a Git repository; refusing to replace it.' >&2
    exit 1
  fi
  git clone --depth 1 --single-branch --branch main "$REPO_URL" "$CHECKOUT"
fi

if [[ "$(git -C "$CHECKOUT" remote get-url origin)" != "$REPO_URL" ]]; then
  echo 'Unexpected Git remote; refusing to deploy.' >&2
  exit 1
fi
if [[ -n "$(git -C "$CHECKOUT" status --porcelain)" ]]; then
  echo 'Server checkout has local changes; refusing to overwrite them.' >&2
  exit 1
fi

GIT_TERMINAL_PROMPT=0 git -C "$CHECKOUT" pull --ff-only origin main
commit="$(git -C "$CHECKOUT" rev-parse HEAD)"
if [[ -f "$DEPLOYED_COMMIT_FILE" && "$(<"$DEPLOYED_COMMIT_FILE")" == "$commit" ]]; then
  echo "Already deployed: $commit"
  exit 0
fi

for required in index.html reports.html stock.html industry.html assets/app.js data/stocks.js; do
  if [[ ! -f "$CHECKOUT/$required" ]]; then
    echo "Required site file is missing: $required" >&2
    exit 1
  fi
done

# Synchronize only this verified site directory. Excluded files are neither
# published nor removed from the existing web root.
rsync -a --delete --delay-updates \
  --exclude='/.git/' \
  --exclude='/.github/' \
  --exclude='/.gitignore' \
  --exclude='/deploy/' \
  --exclude='/docs/' \
  --exclude='/README.md' \
  --exclude='/AGENTS.md' \
  --exclude='.DS_Store' \
  "$CHECKOUT/" "$WEB_ROOT/"

printf '%s\n' "$commit" > "$DEPLOYED_COMMIT_FILE.tmp"
mv "$DEPLOYED_COMMIT_FILE.tmp" "$DEPLOYED_COMMIT_FILE"
echo "Deployed: $commit"

#!/bin/bash
# Build (or rebuild) the oneshot-video E2B template (v2 build system) in the team that owns
# E2B_API_KEY (the OneShot team).
#
#   packages/explore/template/build.sh            # uses ../one-shot for run-agent.ts
#   ONESHOT_DIR=/path/to/one-shot build.sh
#
# run-agent.ts is copied into a gitignored build dir, never into the repo. Rebuild after
# run-agent.ts changes in one-shot, same as its own template.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
oneshot="${ONESHOT_DIR:-$repo/../one-shot}"
src="$oneshot/apps/worker-service/agent_tier/run-agent.ts"
[ -f "$src" ] || { echo "run-agent.ts not found at $src (set ONESHOT_DIR)" >&2; exit 1; }

build="$here/.build"
rm -rf "$build" && mkdir -p "$build"
cp "$here/e2b.Dockerfile" "$here/start.sh" "$here/setup-db.sh" "$build/"
cp "$src" "$build/run-agent.ts"
echo "run-agent.ts from $(git -C "$oneshot" rev-parse --short HEAD 2>/dev/null || echo '?') ($(wc -l < "$src") lines)"

cp "$here/build.ts" "$build/"
cd "$build"
# The template builder is e2b v2; the repo's explore package stays on v1 for Sandbox.
echo '{ "private": true, "type": "module" }' > package.json
bun add --silent e2b@2.51.0 >/dev/null
bun --env-file="$repo/.env" run build.ts

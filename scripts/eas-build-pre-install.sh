#!/usr/bin/env bash
# Runs on the EAS Build worker, before EAS installs dependencies.
#
# EAS runs `npm ci` whenever a package-lock.json is present, and `npm ci` hard-fails on this
# lockfile with "Missing: @emnapi/core from lock file". That package is an optional wasm fallback
# pulled in transitively (via the eslint import resolver's native bindings); which of those
# fallbacks npm records in the lockfile depends on the platform the lockfile was generated on. Ours
# is written on macOS, where that edge resolves away and gets no `node_modules/@emnapi/core` entry —
# so on EAS's Linux worker, where the edge is real, `npm ci` sees a dependency with no package node
# and aborts. npm on macOS won't add the entry (`npm install --package-lock-only` reports the lock
# "up to date"), and we have no Linux box to regenerate it on.
#
# CI hit the same wall and fixed it by using `npm install`, which honours the lockfile but tolerates
# that platform skew instead of aborting. We can't tell EAS to use `npm install` directly, but EAS
# only reaches for `npm ci` when it finds a lockfile — so removing it here, on the worker only,
# makes EAS fall back to `npm install`. The committed lockfile is untouched; this deletes the copy
# EAS unpacked onto the builder, for this build only.
set -euo pipefail

rm -f package-lock.json
echo "eas-build-pre-install: removed package-lock.json on the builder so EAS uses 'npm install' (see script header)."

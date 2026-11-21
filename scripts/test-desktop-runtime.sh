#!/bin/sh
# Use an isolated module so testing cannot modify MB's checkout or module files.
set -eu
: "${MOEJS_HOST_DIR:?Set MOEJS_HOST_DIR to the read-only MB repository}"
plugin_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
case "$MOEJS_HOST_DIR" in /*) ;; *) MOEJS_HOST_DIR=$(CDPATH= cd -- "$MOEJS_HOST_DIR" && pwd);; esac
runtime_tmp=$(mktemp -d "${TMPDIR:-/tmp}/qqmusic-moejs.XXXXXX")
trap 'rm -rf "$runtime_tmp"' EXIT HUP INT TERM
cp "$MOEJS_HOST_DIR/go.mod" "$MOEJS_HOST_DIR/go.sum" "$runtime_tmp/"
cd "$runtime_tmp"
GOFLAGS=-mod=readonly go run "$plugin_root/scripts/runtime/main.go" "$plugin_root/dist/index.js" "$plugin_root/scripts/runtime/fixture.js"

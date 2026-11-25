#!/usr/bin/env bash
# Encode rendered Blender PNG sequences in renders/<film>/<res>/ into web-ready
# WebP/AVIF sequences, manifests, assets/films/index.json, and optional all-intra AV1.
#
# Usage (from the repo root):
#   bash blender/encode.sh                              # encode all films in renders/ (WebP, 24 fps)
#   bash blender/encode.sh pool echo_descent            # encode specific films
#   bash blender/encode.sh --preset 4k --format avif    # encode 4K renders as AVIF
#   bash blender/encode.sh --preset 8k240 --av1         # encode 8K 240 fps renders + all-intra AV1
#   bash blender/encode.sh --fps 240 --frames 1-2000 --av1 pool
#
# All flags are forwarded directly to blender/encode.py (which uses ffmpeg when available
# and falls back cleanly to Pillow).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[encode.sh] ERROR: python3/python not found on PATH." >&2
  exit 1
fi

exec "$PY" "$SCRIPT_DIR/encode.py" "$@"

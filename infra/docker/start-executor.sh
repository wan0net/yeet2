#!/bin/sh
set -eu

EXECUTOR_HOST="${YEET2_HOST:-0.0.0.0}"
EXECUTOR_PORT_VALUE="${EXECUTOR_PORT:-8021}"

export EXECUTOR_HOST
export EXECUTOR_PORT_VALUE

exec python - <<'PY'
import os
from yeet2_executor.http import serve

host = os.environ.get("EXECUTOR_HOST", "0.0.0.0")
port = int(os.environ.get("EXECUTOR_PORT_VALUE", "8021"))
serve(host=host, port=port)
PY

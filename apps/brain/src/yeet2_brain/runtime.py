"""Runtime bootstrap for the Brain service."""

from __future__ import annotations

import os
from pathlib import Path


def bootstrap_runtime() -> None:
    package_root = Path(__file__).resolve().parent.parent.parent
    repo_home = package_root / ".home"
    crewai_storage_dir = package_root / ".crewai-data"

    home = Path(os.environ.setdefault("HOME", str(repo_home)))
    storage_dir = Path(os.environ.setdefault("CREWAI_STORAGE_DIR", str(crewai_storage_dir)))
    os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")
    os.environ.setdefault("OTEL_SDK_DISABLED", "true")

    home.mkdir(parents=True, exist_ok=True)
    storage_dir.mkdir(parents=True, exist_ok=True)

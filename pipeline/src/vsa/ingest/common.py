"""Shared ingest helpers: snapshotting every raw pull so results are reproducible."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import requests

from ..config import RAW

MANIFEST = RAW / "MANIFEST.md"


def snapshot(name: str, content: bytes, meta: dict) -> Path:
    """Persist a raw pull under data/raw/<name>/ and append to the manifest."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    d = RAW / name
    d.mkdir(parents=True, exist_ok=True)
    sha = hashlib.sha256(content).hexdigest()[:12]
    path = d / f"{ts}_{sha}{meta.get('ext', '.bin')}"
    path.write_bytes(content)
    (d / f"{ts}_{sha}.meta.json").write_text(
        json.dumps({**meta, "sha256_12": sha, "pulled_at": ts}, indent=2)
    )
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST.open("a") as f:
        f.write(f"- {ts} {name} {sha} {meta.get('url', '')}\n")
    return path


def fetch(url: str, *, name: str, ext: str, session: requests.Session | None = None,
          timeout: int = 120, **kwargs) -> bytes:
    s = session or requests.Session()
    r = s.get(url, timeout=timeout, **kwargs)
    r.raise_for_status()
    snapshot(name, r.content, {"url": url, "ext": ext, "status": r.status_code})
    return r.content

# Telemetry View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `telemetry-view` subcommand that launches a local web server to visualize JSONL tracing data in the browser.

**Architecture:** aiohttp async server serves a vanilla JS SPA + REST API + SSE endpoint. On startup, scans JSONL trace directories, builds an in-memory session index, then polls for file changes every 2 seconds pushing updates via SSE.

**Tech Stack:** Python 3.10+ (aiohttp), vanilla HTML/JS/CSS (no build step)

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/alibabacloud/mcp_proxy/telemetry_view/__init__.py` | Package marker, exports `run_telemetry_view` |
| `src/alibabacloud/mcp_proxy/telemetry_view/data.py` | JSONL parsing, span merging, session index, directory resolution, file watcher |
| `src/alibabacloud/mcp_proxy/telemetry_view/server.py` | aiohttp app setup, route handlers, SSE endpoint, startup/shutdown |
| `src/alibabacloud/mcp_proxy/telemetry_view/static/index.html` | SPA shell HTML |
| `src/alibabacloud/mcp_proxy/telemetry_view/static/app.js` | Client-side router, rendering, SSE client, theme toggle |
| `src/alibabacloud/mcp_proxy/telemetry_view/static/style.css` | Light/dark themes, layout, span colors |
| `src/alibabacloud/mcp_proxy/cli.py` | Modify: add `telemetry-view` subcommand (lines 180-225, 454-466) |
| `pyproject.toml` | Modify: add `aiohttp>=3.9.0` dependency |
| `tests/test_telemetry_view_data.py` | Unit tests for data.py |
| `tests/test_telemetry_view_server.py` | Integration tests for server routes |

---

## Task 1: Project Setup — Dependency & Package Skeleton

**Files:**
- Modify: `pyproject.toml`
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/__init__.py`
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/data.py`
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/server.py`
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/static/.gitkeep`

- [ ] **Step 1: Add aiohttp dependency to pyproject.toml**

```toml
dependencies = [
    "aiohttp>=3.9.0",
    "alibabacloud-credentials>=1.0.8",
    "alibabacloud-openapi-util>=0.2.4",
    "alibabacloud-tea-openapi>=0.4.4",
    "alibabacloud-tea-util>=0.3.14",
    "httpx>=0.28.1",
    "mcp>=1.27.0",
]
```

- [ ] **Step 2: Create package skeleton files**

`src/alibabacloud/mcp_proxy/telemetry_view/__init__.py`:
```python
from __future__ import annotations

from alibabacloud.mcp_proxy.telemetry_view.server import run_telemetry_view

__all__ = ["run_telemetry_view"]
```

`src/alibabacloud/mcp_proxy/telemetry_view/data.py`:
```python
from __future__ import annotations
```

`src/alibabacloud/mcp_proxy/telemetry_view/server.py`:
```python
from __future__ import annotations


async def run_telemetry_view(port: int, no_open: bool) -> None:
    raise NotImplementedError
```

- [ ] **Step 3: Create static directory with .gitkeep**

```bash
mkdir -p src/alibabacloud/mcp_proxy/telemetry_view/static
touch src/alibabacloud/mcp_proxy/telemetry_view/static/.gitkeep
```

- [ ] **Step 4: Install dependencies and verify import**

```bash
cd /Users/caihe/projects/ai/alibabacloud-api-mcp-server
uv sync
python -c "from alibabacloud.mcp_proxy.telemetry_view import run_telemetry_view; print('OK')"
```

Expected: prints `OK`

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml uv.lock src/alibabacloud/mcp_proxy/telemetry_view/
git commit -m "feat(telemetry-view): add package skeleton and aiohttp dependency"
```

---

## Task 2: Data Layer — Directory Resolution & JSONL Parsing

**Files:**
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/data.py`
- Create: `tests/test_telemetry_view_data.py`

- [ ] **Step 1: Write failing tests for directory resolution and JSONL parsing**

`tests/test_telemetry_view_data.py`:
```python
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from alibabacloud.mcp_proxy.telemetry_view.data import (
    resolve_data_dirs,
    parse_jsonl_file,
    build_session_index,
    SessionMeta,
)


@pytest.fixture
def trace_dir(tmp_path: Path) -> Path:
    """Create a minimal trace directory structure with sample data."""
    traces_dir = tmp_path / "claude-code" / "traces"
    traces_dir.mkdir(parents=True)
    jsonl_file = traces_dir / "sess-001.jsonl"
    lines = [
        {
            "event": "prompt",
            "span_id": "span-root-0",
            "parent_span_id": None,
            "turn": 0,
            "start_timestamp": "2026-05-20T06:11:20.455Z",
            "end_timestamp": "2026-05-20T06:13:02.064Z",
            "session_id": "sess-001",
            "client": "claude-code",
            "prompt": "Help me list ECS instances in cn-hangzhou region",
        },
        {
            "event": "tool_start",
            "span_id": "span-tool-1",
            "parent_span_id": "span-root-0",
            "turn": 0,
            "start_timestamp": "2026-05-20T06:11:25.000Z",
            "end_timestamp": "2026-05-20T06:11:25.000Z",
            "session_id": "sess-001",
            "client": "claude-code",
            "tool_name": "AlibabaCloud___CallCLI",
            "tool_use_id": "toolu_001",
            "tool_input": {"command": "aliyun ecs DescribeInstances --RegionId cn-hangzhou"},
        },
        {
            "event": "tool_end",
            "span_id": "span-tool-1",
            "parent_span_id": "span-root-0",
            "turn": 0,
            "start_timestamp": "2026-05-20T06:11:25.000Z",
            "end_timestamp": "2026-05-20T06:11:27.500Z",
            "session_id": "sess-001",
            "client": "claude-code",
            "tool_name": "AlibabaCloud___CallCLI",
            "tool_use_id": "toolu_001",
            "status": "success",
            "error_message": None,
            "request_id": "REQ-123",
            "duration_ms": 2500,
            "tool_response": [{"type": "text", "text": "{\"Instances\": []}"}],
            "truncated": False,
        },
        {
            "event": "turn_end",
            "span_id": "span-turn-end-0",
            "parent_span_id": "span-root-0",
            "turn": 0,
            "start_timestamp": "2026-05-20T06:13:02.064Z",
            "end_timestamp": "2026-05-20T06:13:02.064Z",
            "session_id": "sess-001",
            "client": "claude-code",
            "stop_reason": "Stop",
        },
    ]
    jsonl_file.write_text("\n".join(json.dumps(line) for line in lines) + "\n")
    return tmp_path


class TestResolveDataDirs:
    def test_returns_existing_dirs_only(self, tmp_path: Path) -> None:
        existing = tmp_path / "telemetry"
        existing.mkdir()
        non_existing = tmp_path / "nope"
        with pytest.MonkeyPatch.context() as mp:
            mp.setenv("ALIBABACLOUD_TELEMETRY_STATE_DIR", str(existing))
            dirs = resolve_data_dirs()
        assert existing in dirs
        assert non_existing not in dirs

    def test_env_var_takes_priority(self, tmp_path: Path) -> None:
        env_dir = tmp_path / "env-telemetry"
        env_dir.mkdir()
        with pytest.MonkeyPatch.context() as mp:
            mp.setenv("ALIBABACLOUD_TELEMETRY_STATE_DIR", str(env_dir))
            dirs = resolve_data_dirs()
        assert dirs[0] == env_dir


class TestParseJsonlFile:
    def test_parses_spans_and_merges_tool_pairs(self, trace_dir: Path) -> None:
        jsonl_file = trace_dir / "claude-code" / "traces" / "sess-001.jsonl"
        spans = parse_jsonl_file(jsonl_file)
        # tool_start + tool_end merged into one span
        tool_spans = [s for s in spans if s["event"] == "tool"]
        assert len(tool_spans) == 1
        assert tool_spans[0]["status"] == "success"
        assert tool_spans[0]["duration_ms"] == 2500
        assert tool_spans[0]["tool_input"]["command"] == "aliyun ecs DescribeInstances --RegionId cn-hangzhou"

    def test_prompt_span_is_root(self, trace_dir: Path) -> None:
        jsonl_file = trace_dir / "claude-code" / "traces" / "sess-001.jsonl"
        spans = parse_jsonl_file(jsonl_file)
        prompts = [s for s in spans if s["event"] == "prompt"]
        assert len(prompts) == 1
        assert prompts[0]["parent_span_id"] is None

    def test_all_spans_have_required_fields(self, trace_dir: Path) -> None:
        jsonl_file = trace_dir / "claude-code" / "traces" / "sess-001.jsonl"
        spans = parse_jsonl_file(jsonl_file)
        for span in spans:
            assert "span_id" in span
            assert "event" in span
            assert "start_timestamp" in span
            assert "end_timestamp" in span


class TestBuildSessionIndex:
    def test_builds_index_from_directory(self, trace_dir: Path) -> None:
        index = build_session_index([trace_dir])
        key = ("claude-code", "sess-001")
        assert key in index
        meta = index[key]
        assert meta.client == "claude-code"
        assert meta.session_id == "sess-001"
        assert meta.span_count == 3  # prompt + merged tool + turn_end
        assert meta.turn_count == 1
        assert meta.has_errors is False
        assert "Help me list ECS" in meta.first_prompt_preview

    def test_empty_directory_returns_empty_index(self, tmp_path: Path) -> None:
        index = build_session_index([tmp_path])
        assert len(index) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_telemetry_view_data.py -v
```

Expected: FAIL — `ImportError` for missing functions

- [ ] **Step 3: Implement data.py**

`src/alibabacloud/mcp_proxy/telemetry_view/data.py`:
```python
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class SessionMeta:
    client: str
    session_id: str
    file_path: Path
    file_offset: int = 0
    start_time: str = ""
    last_activity: str = ""
    first_prompt_preview: str = ""
    span_count: int = 0
    turn_count: int = 0
    has_errors: bool = False


def resolve_data_dirs() -> list[Path]:
    dirs: list[Path] = []
    env_dir = os.environ.get("ALIBABACLOUD_TELEMETRY_STATE_DIR")
    if env_dir:
        dirs.append(Path(env_dir))
    dirs.append(Path.home() / ".cache" / "alibabacloud-agent-toolkit" / "telemetry")
    uid = os.getuid() if hasattr(os, "getuid") else 0
    dirs.append(Path(f"/tmp/alibabacloud-agent-toolkit-telemetry-{uid}"))
    return [d for d in dirs if d.exists()]


def parse_jsonl_file(file_path: Path, offset: int = 0) -> list[dict[str, Any]]:
    raw_events: list[dict[str, Any]] = []
    with open(file_path, "r", encoding="utf-8") as f:
        if offset:
            f.seek(offset)
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw_events.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return _merge_tool_spans(raw_events)


def _merge_tool_spans(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tool_starts: dict[str, dict[str, Any]] = {}
    merged: list[dict[str, Any]] = []

    for ev in events:
        event_type = ev.get("event")
        if event_type == "tool_start":
            tool_starts[ev["span_id"]] = ev
        elif event_type == "tool_end":
            span_id = ev["span_id"]
            start_ev = tool_starts.pop(span_id, None)
            merged_span: dict[str, Any] = {
                "span_id": span_id,
                "parent_span_id": ev.get("parent_span_id"),
                "event": "tool",
                "turn": ev.get("turn"),
                "session_id": ev.get("session_id"),
                "client": ev.get("client"),
                "tool_name": ev.get("tool_name"),
                "tool_use_id": ev.get("tool_use_id"),
                "start_timestamp": start_ev["start_timestamp"] if start_ev else ev.get("start_timestamp"),
                "end_timestamp": ev.get("end_timestamp"),
                "duration_ms": ev.get("duration_ms"),
                "status": ev.get("status"),
                "error_message": ev.get("error_message"),
                "request_id": ev.get("request_id"),
                "tool_input": start_ev.get("tool_input") if start_ev else None,
                "tool_response": ev.get("tool_response"),
                "truncated": ev.get("truncated", False),
            }
            merged.append(merged_span)
        else:
            merged.append(ev)

    # Orphaned tool_starts (no matching tool_end yet) — include as incomplete
    for span_id, start_ev in tool_starts.items():
        merged.append({
            **start_ev,
            "event": "tool",
            "status": "pending",
            "duration_ms": None,
            "tool_response": None,
            "truncated": False,
            "error_message": None,
            "request_id": None,
        })

    return merged


def build_session_index(data_dirs: list[Path]) -> dict[tuple[str, str], SessionMeta]:
    index: dict[tuple[str, str], SessionMeta] = {}

    for base_dir in data_dirs:
        if not base_dir.exists():
            continue
        for client_dir in base_dir.iterdir():
            if not client_dir.is_dir():
                continue
            traces_dir = client_dir / "traces"
            if not traces_dir.exists():
                continue
            client = client_dir.name
            for jsonl_file in traces_dir.glob("*.jsonl"):
                spans = parse_jsonl_file(jsonl_file)
                if not spans:
                    continue
                session_id = _extract_session_id(spans, jsonl_file)
                meta = _build_meta(client, session_id, jsonl_file, spans)
                index[(client, session_id)] = meta

    return index


def _extract_session_id(spans: list[dict[str, Any]], file_path: Path) -> str:
    for span in spans:
        sid = span.get("session_id")
        if sid:
            return sid
    return file_path.stem


def _build_meta(
    client: str,
    session_id: str,
    file_path: Path,
    spans: list[dict[str, Any]],
) -> SessionMeta:
    timestamps: list[str] = []
    prompt_preview = ""
    turn_numbers: set[int] = set()
    has_errors = False

    for span in spans:
        ts = span.get("start_timestamp", "")
        te = span.get("end_timestamp", "")
        if ts:
            timestamps.append(ts)
        if te:
            timestamps.append(te)

        turn = span.get("turn")
        if turn is not None:
            turn_numbers.add(turn)

        if span.get("event") == "prompt" and not prompt_preview:
            raw = span.get("prompt", "")
            prompt_preview = raw[:80] if raw else ""

        if span.get("status") == "failure" or span.get("stop_reason") == "StopFailure":
            has_errors = True

    timestamps.sort()
    file_size = file_path.stat().st_size

    return SessionMeta(
        client=client,
        session_id=session_id,
        file_path=file_path,
        file_offset=file_size,
        start_time=timestamps[0] if timestamps else "",
        last_activity=timestamps[-1] if timestamps else "",
        first_prompt_preview=prompt_preview,
        span_count=len(spans),
        turn_count=len(turn_numbers),
        has_errors=has_errors,
    )


def build_span_tree(spans: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    roots: list[dict[str, Any]] = []

    for span in spans:
        span_copy = {**span, "children": []}
        by_id[span["span_id"]] = span_copy

    for span in spans:
        node = by_id[span["span_id"]]
        parent_id = span.get("parent_span_id")
        if parent_id is None:
            roots.append(node)
        elif parent_id in by_id:
            by_id[parent_id]["children"].append(node)
        else:
            roots.append(node)

    def sort_children(node: dict[str, Any]) -> None:
        node["children"].sort(key=lambda c: c.get("start_timestamp", ""))
        for child in node["children"]:
            sort_children(child)

    for root in roots:
        sort_children(root)
    roots.sort(key=lambda r: r.get("start_timestamp", ""))
    return roots
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_telemetry_view_data.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/alibabacloud/mcp_proxy/telemetry_view/data.py tests/test_telemetry_view_data.py
git commit -m "feat(telemetry-view): implement JSONL parsing, span merging, session index"
```

---

## Task 3: Data Layer — File Watcher

**Files:**
- Modify: `src/alibabacloud/mcp_proxy/telemetry_view/data.py`
- Create: `tests/test_telemetry_view_watcher.py`

- [ ] **Step 1: Write failing test for file watcher**

`tests/test_telemetry_view_watcher.py`:
```python
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from alibabacloud.mcp_proxy.telemetry_view.data import (
    TraceFileWatcher,
    build_session_index,
    SessionMeta,
)


@pytest.fixture
def trace_dir(tmp_path: Path) -> Path:
    traces_dir = tmp_path / "claude-code" / "traces"
    traces_dir.mkdir(parents=True)
    jsonl_file = traces_dir / "sess-watch.jsonl"
    line = {
        "event": "prompt",
        "span_id": "sp-1",
        "parent_span_id": None,
        "turn": 0,
        "start_timestamp": "2026-05-20T10:00:00.000Z",
        "end_timestamp": "2026-05-20T10:00:05.000Z",
        "session_id": "sess-watch",
        "client": "claude-code",
        "prompt": "initial prompt",
    }
    jsonl_file.write_text(json.dumps(line) + "\n")
    return tmp_path


@pytest.mark.asyncio
async def test_watcher_detects_appended_lines(trace_dir: Path) -> None:
    index = build_session_index([trace_dir])
    events: list[dict] = []

    async def on_change(event_type: str, data: dict) -> None:
        events.append({"type": event_type, **data})

    watcher = TraceFileWatcher(index, [trace_dir], on_change=on_change, poll_interval=0.1)
    task = asyncio.ensure_future(watcher.run())

    # Append a new line
    await asyncio.sleep(0.05)
    jsonl_file = trace_dir / "claude-code" / "traces" / "sess-watch.jsonl"
    new_line = {
        "event": "tool_start",
        "span_id": "sp-2",
        "parent_span_id": "sp-1",
        "turn": 0,
        "start_timestamp": "2026-05-20T10:00:01.000Z",
        "end_timestamp": "2026-05-20T10:00:01.000Z",
        "session_id": "sess-watch",
        "client": "claude-code",
        "tool_name": "CallCLI",
        "tool_use_id": "toolu_002",
        "tool_input": {"command": "aliyun ecs DescribeInstances"},
    }
    with open(jsonl_file, "a") as f:
        f.write(json.dumps(new_line) + "\n")

    await asyncio.sleep(0.3)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert len(events) >= 1
    assert events[0]["type"] == "session_updated"
    assert index[("claude-code", "sess-watch")].span_count == 2


@pytest.mark.asyncio
async def test_watcher_detects_new_files(trace_dir: Path) -> None:
    index = build_session_index([trace_dir])
    events: list[dict] = []

    async def on_change(event_type: str, data: dict) -> None:
        events.append({"type": event_type, **data})

    watcher = TraceFileWatcher(index, [trace_dir], on_change=on_change, poll_interval=0.1)
    task = asyncio.ensure_future(watcher.run())

    await asyncio.sleep(0.05)
    new_file = trace_dir / "claude-code" / "traces" / "sess-new.jsonl"
    line = {
        "event": "prompt",
        "span_id": "sp-new-1",
        "parent_span_id": None,
        "turn": 0,
        "start_timestamp": "2026-05-20T12:00:00.000Z",
        "end_timestamp": "2026-05-20T12:00:10.000Z",
        "session_id": "sess-new",
        "client": "claude-code",
        "prompt": "a brand new session",
    }
    new_file.write_text(json.dumps(line) + "\n")

    await asyncio.sleep(0.3)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert ("claude-code", "sess-new") in index
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_telemetry_view_watcher.py -v
```

Expected: FAIL — `ImportError: cannot import name 'TraceFileWatcher'`

- [ ] **Step 3: Implement TraceFileWatcher in data.py**

Append to `src/alibabacloud/mcp_proxy/telemetry_view/data.py`:
```python
import asyncio
from typing import Callable, Awaitable


class TraceFileWatcher:
    def __init__(
        self,
        index: dict[tuple[str, str], SessionMeta],
        data_dirs: list[Path],
        on_change: Callable[[str, dict[str, Any]], Awaitable[None]],
        poll_interval: float = 2.0,
    ) -> None:
        self._index = index
        self._data_dirs = data_dirs
        self._on_change = on_change
        self._poll_interval = poll_interval
        self._known_files: set[Path] = {meta.file_path for meta in index.values()}

    async def run(self) -> None:
        while True:
            await self._check_existing_files()
            await self._check_new_files()
            await asyncio.sleep(self._poll_interval)

    async def _check_existing_files(self) -> None:
        for key, meta in list(self._index.items()):
            if not meta.file_path.exists():
                continue
            current_size = meta.file_path.stat().st_size
            if current_size <= meta.file_offset:
                continue
            new_spans = parse_jsonl_file(meta.file_path, offset=meta.file_offset)
            if not new_spans:
                meta.file_offset = current_size
                continue
            self._update_meta(meta, new_spans, current_size)
            await self._on_change("session_updated", {
                "client": meta.client,
                "session_id": meta.session_id,
                "last_activity": meta.last_activity,
                "span_count": meta.span_count,
                "new_spans": new_spans,
            })

    async def _check_new_files(self) -> None:
        for base_dir in self._data_dirs:
            if not base_dir.exists():
                continue
            for client_dir in base_dir.iterdir():
                if not client_dir.is_dir():
                    continue
                traces_dir = client_dir / "traces"
                if not traces_dir.exists():
                    continue
                for jsonl_file in traces_dir.glob("*.jsonl"):
                    if jsonl_file in self._known_files:
                        continue
                    self._known_files.add(jsonl_file)
                    spans = parse_jsonl_file(jsonl_file)
                    if not spans:
                        continue
                    client = client_dir.name
                    session_id = _extract_session_id(spans, jsonl_file)
                    meta = _build_meta(client, session_id, jsonl_file, spans)
                    self._index[(client, session_id)] = meta
                    await self._on_change("session_updated", {
                        "client": meta.client,
                        "session_id": meta.session_id,
                        "last_activity": meta.last_activity,
                        "span_count": meta.span_count,
                        "new_spans": spans,
                    })

    def _update_meta(self, meta: SessionMeta, new_spans: list[dict[str, Any]], new_offset: int) -> None:
        meta.file_offset = new_offset
        meta.span_count += len(new_spans)

        for span in new_spans:
            ts = span.get("end_timestamp") or span.get("start_timestamp", "")
            if ts and ts > meta.last_activity:
                meta.last_activity = ts

            turn = span.get("turn")
            if turn is not None:
                expected_turns = turn + 1
                if expected_turns > meta.turn_count:
                    meta.turn_count = expected_turns

            if span.get("status") == "failure" or span.get("stop_reason") == "StopFailure":
                meta.has_errors = True
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_telemetry_view_watcher.py -v
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/alibabacloud/mcp_proxy/telemetry_view/data.py tests/test_telemetry_view_watcher.py
git commit -m "feat(telemetry-view): add TraceFileWatcher for live JSONL monitoring"
```

---

## Task 4: Server — aiohttp App with REST API

**Files:**
- Modify: `src/alibabacloud/mcp_proxy/telemetry_view/server.py`
- Create: `tests/test_telemetry_view_server.py`

- [ ] **Step 1: Write failing tests for server routes**

`tests/test_telemetry_view_server.py`:
```python
from __future__ import annotations

import json
from pathlib import Path

import pytest
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop, TestClient, TestServer

from alibabacloud.mcp_proxy.telemetry_view.server import create_app
from alibabacloud.mcp_proxy.telemetry_view.data import build_session_index


@pytest.fixture
def trace_dir(tmp_path: Path) -> Path:
    traces_dir = tmp_path / "claude-code" / "traces"
    traces_dir.mkdir(parents=True)
    jsonl_file = traces_dir / "sess-api-test.jsonl"
    lines = [
        {
            "event": "prompt", "span_id": "sp-1", "parent_span_id": None,
            "turn": 0, "start_timestamp": "2026-05-20T06:11:20.455Z",
            "end_timestamp": "2026-05-20T06:13:02.064Z",
            "session_id": "sess-api-test", "client": "claude-code",
            "prompt": "Help me with ACK cluster setup",
        },
        {
            "event": "tool_start", "span_id": "sp-2", "parent_span_id": "sp-1",
            "turn": 0, "start_timestamp": "2026-05-20T06:11:25.000Z",
            "end_timestamp": "2026-05-20T06:11:25.000Z",
            "session_id": "sess-api-test", "client": "claude-code",
            "tool_name": "AlibabaCloud___GetApiDefinition",
            "tool_use_id": "toolu_t1", "tool_input": {"product": "CS"},
        },
        {
            "event": "tool_end", "span_id": "sp-2", "parent_span_id": "sp-1",
            "turn": 0, "start_timestamp": "2026-05-20T06:11:25.000Z",
            "end_timestamp": "2026-05-20T06:11:27.000Z",
            "session_id": "sess-api-test", "client": "claude-code",
            "tool_name": "AlibabaCloud___GetApiDefinition",
            "tool_use_id": "toolu_t1", "status": "success",
            "error_message": None, "request_id": "R1",
            "duration_ms": 2000, "tool_response": [{"type": "text", "text": "{}"}],
            "truncated": False,
        },
        {
            "event": "turn_end", "span_id": "sp-3", "parent_span_id": "sp-1",
            "turn": 0, "start_timestamp": "2026-05-20T06:13:02.064Z",
            "end_timestamp": "2026-05-20T06:13:02.064Z",
            "session_id": "sess-api-test", "client": "claude-code",
            "stop_reason": "Stop",
        },
    ]
    jsonl_file.write_text("\n".join(json.dumps(l) for l in lines) + "\n")
    return tmp_path


@pytest.fixture
async def client(trace_dir: Path, aiohttp_client) -> TestClient:
    index = build_session_index([trace_dir])
    app = create_app(index=index, data_dirs=[trace_dir])
    return await aiohttp_client(app)


@pytest.mark.asyncio
async def test_get_sessions_returns_list(client: TestClient) -> None:
    resp = await client.get("/api/sessions")
    assert resp.status == 200
    data = await resp.json()
    assert "sessions" in data
    assert data["total"] == 1
    assert data["sessions"][0]["client"] == "claude-code"
    assert data["sessions"][0]["session_id"] == "sess-api-test"
    assert "Help me with ACK" in data["sessions"][0]["first_prompt_preview"]


@pytest.mark.asyncio
async def test_get_sessions_pagination(client: TestClient) -> None:
    resp = await client.get("/api/sessions?page=1&page_size=10")
    assert resp.status == 200
    data = await resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_get_sessions_filter_by_client(client: TestClient) -> None:
    resp = await client.get("/api/sessions?client=codex")
    assert resp.status == 200
    data = await resp.json()
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_session_detail_returns_tree(client: TestClient) -> None:
    resp = await client.get("/api/sessions/claude-code/sess-api-test")
    assert resp.status == 200
    data = await resp.json()
    assert data["client"] == "claude-code"
    assert data["session_id"] == "sess-api-test"
    assert len(data["spans"]) == 1  # one root prompt
    root = data["spans"][0]
    assert root["event"] == "prompt"
    assert len(root["children"]) == 2  # merged tool + turn_end


@pytest.mark.asyncio
async def test_get_session_detail_not_found(client: TestClient) -> None:
    resp = await client.get("/api/sessions/claude-code/nonexistent")
    assert resp.status == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_telemetry_view_server.py -v
```

Expected: FAIL — `ImportError: cannot import name 'create_app'`

- [ ] **Step 3: Implement server.py**

`src/alibabacloud/mcp_proxy/telemetry_view/server.py`:
```python
from __future__ import annotations

import asyncio
import json
import webbrowser
from pathlib import Path
from typing import Any

from aiohttp import web

from alibabacloud.mcp_proxy.telemetry_view.data import (
    SessionMeta,
    TraceFileWatcher,
    build_span_tree,
    parse_jsonl_file,
)

_STATIC_DIR = Path(__file__).parent / "static"


def create_app(
    index: dict[tuple[str, str], SessionMeta],
    data_dirs: list[Path],
) -> web.Application:
    app = web.Application()
    app["index"] = index
    app["data_dirs"] = data_dirs
    app["sse_clients"] = []

    app.router.add_get("/api/sessions", handle_sessions)
    app.router.add_get("/api/sessions/{client}/{session_id}", handle_session_detail)
    app.router.add_get("/api/events", handle_sse)
    app.router.add_get("/", handle_index)
    app.router.add_static("/static", _STATIC_DIR, name="static")

    return app


async def handle_index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(_STATIC_DIR / "index.html")


async def handle_sessions(request: web.Request) -> web.Response:
    index = request.app["index"]
    page = int(request.query.get("page", "1"))
    page_size = int(request.query.get("page_size", "20"))
    client_filter = request.query.get("client", "")
    query = request.query.get("q", "").lower()
    start_time = request.query.get("start_time", "")
    end_time = request.query.get("end_time", "")

    sessions = list(index.values())

    if client_filter:
        sessions = [s for s in sessions if s.client == client_filter]
    if query:
        sessions = [s for s in sessions if query in s.first_prompt_preview.lower() or query in s.session_id.lower()]
    if start_time:
        sessions = [s for s in sessions if s.start_time >= start_time]
    if end_time:
        sessions = [s for s in sessions if s.last_activity <= end_time]

    sessions.sort(key=lambda s: s.last_activity, reverse=True)
    total = len(sessions)
    start = (page - 1) * page_size
    page_sessions = sessions[start:start + page_size]

    return web.json_response({
        "sessions": [
            {
                "client": s.client,
                "session_id": s.session_id,
                "first_prompt_preview": s.first_prompt_preview,
                "start_time": s.start_time,
                "last_activity": s.last_activity,
                "span_count": s.span_count,
                "turn_count": s.turn_count,
                "has_errors": s.has_errors,
            }
            for s in page_sessions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    })


async def handle_session_detail(request: web.Request) -> web.Response:
    index = request.app["index"]
    client = request.match_info["client"]
    session_id = request.match_info["session_id"]

    key = (client, session_id)
    if key not in index:
        return web.json_response({"error": "Session not found"}, status=404)

    meta = index[key]
    spans = parse_jsonl_file(meta.file_path)
    tree = build_span_tree(spans)

    return web.json_response({
        "client": client,
        "session_id": session_id,
        "start_time": meta.start_time,
        "last_activity": meta.last_activity,
        "spans": tree,
    })


async def handle_sse(request: web.Request) -> web.StreamResponse:
    response = web.StreamResponse(
        status=200,
        reason="OK",
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
    await response.prepare(request)

    queue: asyncio.Queue[str] = asyncio.Queue()
    request.app["sse_clients"].append(queue)

    try:
        while True:
            data = await queue.get()
            await response.write(data.encode("utf-8"))
    except (asyncio.CancelledError, ConnectionResetError):
        pass
    finally:
        request.app["sse_clients"].remove(queue)

    return response


async def broadcast_sse(app: web.Application, event_type: str, data: dict[str, Any]) -> None:
    payload = json.dumps(data, ensure_ascii=False, default=str)
    message = f"event: {event_type}\ndata: {payload}\n\n"
    for queue in app["sse_clients"]:
        await queue.put(message)


async def run_telemetry_view(port: int, no_open: bool) -> None:
    from alibabacloud.mcp_proxy.telemetry_view.data import (
        build_session_index,
        resolve_data_dirs,
    )

    data_dirs = resolve_data_dirs()
    if not data_dirs:
        print("Warning: No telemetry data directories found.")
        print("Checked:")
        print("  - $ALIBABACLOUD_TELEMETRY_STATE_DIR")
        print("  - ~/.cache/alibabacloud-agent-toolkit/telemetry/")
        print(f"  - /tmp/alibabacloud-agent-toolkit-telemetry-<uid>/")
        data_dirs = []

    index = build_session_index(data_dirs)
    app = create_app(index=index, data_dirs=data_dirs)

    async def on_change(event_type: str, data: dict[str, Any]) -> None:
        sse_data = {k: v for k, v in data.items() if k != "new_spans"}
        await broadcast_sse(app, event_type, sse_data)
        if "new_spans" in data:
            await broadcast_sse(app, "new_spans", {
                "client": data["client"],
                "session_id": data["session_id"],
                "spans": data["new_spans"],
            })

    watcher = TraceFileWatcher(index, data_dirs, on_change=on_change)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", port)
    await site.start()

    url = f"http://localhost:{port}"
    session_count = len(index)
    dir_count = len(data_dirs)

    print(f"Telemetry viewer: {url}")
    print(f"Watching {dir_count} directories, found {session_count} sessions")

    if not no_open:
        webbrowser.open(url)

    watcher_task = asyncio.ensure_future(watcher.run())
    try:
        await asyncio.Event().wait()  # run forever
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        watcher_task.cancel()
        await runner.cleanup()
```

- [ ] **Step 4: Add pytest-aiohttp to dev dependencies in pyproject.toml**

```toml
[dependency-groups]
dev = [
    "pytest>=9.0.3",
    "pytest-asyncio>=1.3.0",
    "pytest-aiohttp>=1.0.0",
]
```

- [ ] **Step 5: Install and run tests**

```bash
uv sync
pytest tests/test_telemetry_view_server.py -v
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/alibabacloud/mcp_proxy/telemetry_view/server.py tests/test_telemetry_view_server.py pyproject.toml uv.lock
git commit -m "feat(telemetry-view): implement aiohttp server with REST API and SSE"
```

---

## Task 5: CLI Integration

**Files:**
- Modify: `src/alibabacloud/mcp_proxy/cli.py`
- Modify: `tests/test_cli.py`

- [ ] **Step 1: Write failing test for CLI parsing**

Add to `tests/test_cli.py`:
```python
from alibabacloud.mcp_proxy.cli import build_parser


def test_telemetry_view_subcommand_default_port() -> None:
    parser = build_parser()
    args = parser.parse_args(["telemetry-view"])
    assert args.command == "telemetry-view"
    assert args.tv_port == 18321
    assert args.tv_no_open is False


def test_telemetry_view_subcommand_custom_port() -> None:
    parser = build_parser()
    args = parser.parse_args(["telemetry-view", "--port", "9999"])
    assert args.tv_port == 9999


def test_telemetry_view_subcommand_no_open() -> None:
    parser = build_parser()
    args = parser.parse_args(["telemetry-view", "--no-open"])
    assert args.tv_no_open is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_cli.py::test_telemetry_view_subcommand_default_port -v
```

Expected: FAIL — `AttributeError: 'Namespace' object has no attribute 'tv_port'`

- [ ] **Step 3: Add telemetry-view subcommand to cli.py**

In `build_parser()` function, after the plugin-telemetry parser (around line 224), add:

```python
    # --- telemetry-view sub-command ---
    telemetry_view_parser = subparsers.add_parser(
        "telemetry-view",
        help="Launch local web UI to browse telemetry traces.",
    )
    telemetry_view_parser.add_argument(
        "--port", type=int, default=18321, dest="tv_port",
        help="Local server port (default: 18321).",
    )
    telemetry_view_parser.add_argument(
        "--no-open", action="store_true", dest="tv_no_open",
        help="Don't auto-open browser.",
    )
```

In `main()` function, add before the default proxy handling:

```python
    if args.command == "telemetry-view":
        return _run_telemetry_view_command(args)
```

Add the handler function:

```python
def _run_telemetry_view_command(args: argparse.Namespace) -> int:
    """Execute the ``telemetry-view`` sub-command."""
    import asyncio
    from alibabacloud.mcp_proxy.telemetry_view import run_telemetry_view

    try:
        asyncio.run(run_telemetry_view(port=args.tv_port, no_open=args.tv_no_open))
    except KeyboardInterrupt:
        pass
    return 0
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_cli.py -v -k telemetry_view
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/alibabacloud/mcp_proxy/cli.py tests/test_cli.py
git commit -m "feat(telemetry-view): add telemetry-view CLI subcommand"
```

---

## Task 6: Frontend — HTML Shell & CSS Themes

**Files:**
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/static/index.html`
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/static/style.css`

- [ ] **Step 1: Create index.html**

`src/alibabacloud/mcp_proxy/telemetry_view/static/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alibaba Cloud Telemetry Viewer</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <header class="app-header">
        <div class="header-left">
            <svg class="app-logo" viewBox="0 0 24 24" width="28" height="28">
                <path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <h1 class="app-title">Telemetry Viewer</h1>
        </div>
        <div class="header-right">
            <button id="theme-toggle" class="btn-icon" title="Toggle theme">
                <svg class="icon-sun" viewBox="0 0 24 24" width="20" height="20">
                    <circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
                <svg class="icon-moon" viewBox="0 0 24 24" width="20" height="20">
                    <path fill="currentColor" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
            </button>
        </div>
    </header>
    <main id="app">
        <div class="loading">Loading sessions...</div>
    </main>
    <script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css with light/dark themes**

`src/alibabacloud/mcp_proxy/telemetry_view/static/style.css`:
```css
/* === CSS Variables — Light Theme (default) === */
:root {
    --bg-primary: #ffffff;
    --bg-secondary: #f8f9fa;
    --bg-tertiary: #f1f3f4;
    --text-primary: #202124;
    --text-secondary: #5f6368;
    --text-tertiary: #80868b;
    --border: #e0e0e0;
    --accent: #1a73e8;
    --accent-light: #e8f0fe;
    --shadow: 0 1px 3px rgba(0,0,0,0.1);
    --shadow-hover: 0 2px 8px rgba(0,0,0,0.15);
    --radius: 8px;
    --span-prompt: #1976d2;
    --span-tool: #f57c00;
    --span-skill: #388e3c;
    --span-turn-end: #757575;
    --span-error: #d32f2f;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
}

/* === Dark Theme === */
[data-theme="dark"] {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-tertiary: #707070;
    --border: #2a2a4a;
    --accent: #4fc3f7;
    --accent-light: #1a3a4a;
    --shadow: 0 1px 3px rgba(0,0,0,0.3);
    --shadow-hover: 0 2px 8px rgba(0,0,0,0.5);
    --span-prompt: #64b5f6;
    --span-tool: #ffb74d;
    --span-skill: #81c784;
    --span-turn-end: #bdbdbd;
    --span-error: #ef5350;
}

/* === Reset & Base === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: var(--font);
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.5;
    min-height: 100vh;
}

/* === Header === */
.app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-primary);
    position: sticky;
    top: 0;
    z-index: 100;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.app-logo { color: var(--accent); }
.app-title { font-size: 18px; font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 8px; }
.btn-icon {
    background: none; border: none; cursor: pointer;
    color: var(--text-secondary); padding: 8px; border-radius: 50%;
    display: flex; align-items: center;
}
.btn-icon:hover { background: var(--bg-secondary); }
[data-theme="dark"] .icon-sun { display: none; }
:root .icon-moon { display: none; }
[data-theme="dark"] .icon-moon { display: block; }

/* === Main Content === */
main { max-width: 1400px; margin: 0 auto; padding: 24px; }
.loading { text-align: center; padding: 48px; color: var(--text-secondary); }

/* === Filter Bar === */
.filter-bar {
    display: flex; gap: 12px; align-items: center;
    padding: 16px; background: var(--bg-secondary);
    border-radius: var(--radius); margin-bottom: 20px;
    flex-wrap: wrap;
}
.filter-bar select, .filter-bar input {
    padding: 8px 12px; border: 1px solid var(--border);
    border-radius: 6px; background: var(--bg-primary);
    color: var(--text-primary); font-size: 14px;
}
.filter-bar input[type="text"] { flex: 1; min-width: 200px; }

/* === Session Cards === */
.session-list { display: flex; flex-direction: column; gap: 12px; }
.session-card {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 16px 20px; background: var(--bg-primary);
    border: 1px solid var(--border); border-radius: var(--radius);
    cursor: pointer; transition: box-shadow 0.2s, border-color 0.2s;
}
.session-card:hover {
    box-shadow: var(--shadow-hover);
    border-color: var(--accent);
}
.session-card .client-logo { width: 36px; height: 36px; flex-shrink: 0; }
.session-card .client-logo svg { width: 100%; height: 100%; }
.session-card .card-body { flex: 1; min-width: 0; }
.session-card .card-title {
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; font-size: 14px;
}
.session-card .card-subtitle {
    font-size: 13px; color: var(--text-secondary); margin-top: 4px;
}
.session-card .card-preview {
    font-size: 13px; color: var(--text-tertiary); margin-top: 6px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.session-card .error-badge {
    display: inline-block; background: var(--span-error); color: #fff;
    font-size: 11px; padding: 1px 6px; border-radius: 10px; margin-left: 8px;
}

/* === Pagination === */
.pagination {
    display: flex; justify-content: center; gap: 8px;
    margin-top: 24px; padding: 16px 0;
}
.pagination button {
    padding: 6px 14px; border: 1px solid var(--border);
    border-radius: 6px; background: var(--bg-primary);
    color: var(--text-primary); cursor: pointer; font-size: 13px;
}
.pagination button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

/* === Trace Detail === */
.trace-header {
    display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
}
.trace-header .back-btn {
    background: none; border: none; cursor: pointer;
    color: var(--accent); font-size: 14px; padding: 6px 12px;
    border-radius: 6px;
}
.trace-header .back-btn:hover { background: var(--accent-light); }

.trace-layout {
    display: flex; gap: 0; border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden; min-height: 400px;
}
.trace-tree {
    width: 40%; border-right: 1px solid var(--border);
    overflow-y: auto; max-height: 600px; padding: 8px 0;
}
.trace-timeline {
    width: 60%; overflow-y: auto; max-height: 600px;
    padding: 8px 12px; position: relative;
}

/* === Span Tree Items === */
.span-item {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; cursor: pointer; font-size: 13px;
    border-left: 3px solid transparent;
}
.span-item:hover { background: var(--bg-secondary); }
.span-item.selected { background: var(--accent-light); border-left-color: var(--accent); }
.span-item .expand-btn {
    width: 16px; height: 16px; display: flex; align-items: center;
    justify-content: center; font-size: 10px; color: var(--text-secondary);
    flex-shrink: 0;
}
.span-item .span-icon { width: 16px; height: 16px; flex-shrink: 0; }
.span-item .span-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.span-item .span-duration {
    font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono);
}
.span-item .span-status-badge {
    font-size: 10px; padding: 1px 5px; border-radius: 8px;
}
.span-item .span-status-badge.success { background: #e8f5e9; color: #2e7d32; }
.span-item .span-status-badge.failure { background: #ffebee; color: #c62828; }
[data-theme="dark"] .span-item .span-status-badge.success { background: #1b5e20; color: #a5d6a7; }
[data-theme="dark"] .span-item .span-status-badge.failure { background: #b71c1c; color: #ef9a9a; }

/* === Timeline Bars === */
.timeline-row {
    display: flex; align-items: center; height: 28px;
    padding: 2px 0; position: relative;
}
.timeline-bar {
    height: 16px; border-radius: 3px; min-width: 2px;
    position: absolute; cursor: pointer; opacity: 0.85;
}
.timeline-bar:hover { opacity: 1; }
.timeline-bar.event-prompt { background: var(--span-prompt); }
.timeline-bar.event-tool { background: var(--span-tool); }
.timeline-bar.event-skill_invocation { background: var(--span-skill); }
.timeline-bar.event-turn_end { background: var(--span-turn-end); }
.timeline-bar.status-failure { background: var(--span-error); }
.timeline-scale {
    font-size: 10px; color: var(--text-tertiary);
    padding: 4px 0; border-bottom: 1px solid var(--border);
    font-family: var(--font-mono); margin-bottom: 4px;
}

/* === Detail Panel === */
.detail-panel {
    margin-top: 16px; border: 1px solid var(--border);
    border-radius: var(--radius); background: var(--bg-secondary);
}
.detail-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    font-weight: 600; font-size: 14px;
}
.detail-panel-body { padding: 16px; }
.detail-section { margin-bottom: 16px; }
.detail-section-title {
    font-size: 12px; font-weight: 600; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;
}
.detail-json {
    background: var(--bg-tertiary); border-radius: 6px;
    padding: 12px; font-family: var(--font-mono); font-size: 12px;
    overflow-x: auto; white-space: pre-wrap; word-break: break-all;
    max-height: 300px; overflow-y: auto;
}
.truncated-warning {
    display: inline-block; background: #fff3e0; color: #e65100;
    font-size: 11px; padding: 2px 8px; border-radius: 4px; margin-bottom: 8px;
}
[data-theme="dark"] .truncated-warning { background: #4a2c00; color: #ffb74d; }
```

- [ ] **Step 3: Remove .gitkeep**

```bash
rm src/alibabacloud/mcp_proxy/telemetry_view/static/.gitkeep
```

- [ ] **Step 4: Verify server serves static files (manual smoke test)**

```bash
python -c "
import asyncio
from aiohttp import web
from alibabacloud.mcp_proxy.telemetry_view.server import create_app
app = create_app(index={}, data_dirs=[])
runner = web.AppRunner(app)
asyncio.run(runner.setup())
print('Static dir exists:', (app.router['static'].get_info()))
"
```

- [ ] **Step 5: Commit**

```bash
git add src/alibabacloud/mcp_proxy/telemetry_view/static/
git commit -m "feat(telemetry-view): add HTML shell and CSS themes (light/dark)"
```

---

## Task 7: Frontend — JavaScript Application

**Files:**
- Create: `src/alibabacloud/mcp_proxy/telemetry_view/static/app.js`

- [ ] **Step 1: Create app.js with full SPA logic**

`src/alibabacloud/mcp_proxy/telemetry_view/static/app.js`:
```javascript
(function() {
'use strict';

// === Client Logos (SVG data URIs) ===
const CLIENT_LOGOS = {
    'claude-code': '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" fill="#D97706"/></svg>',
    'vscode': '<svg viewBox="0 0 24 24"><path d="M17.583 2.247l-5.375 4.94L6.792 3.06 2 5.12v13.76l4.792 2.06 5.416-4.127 5.375 4.94L22 19.693V4.307l-4.417-2.06zM6.792 15.5V8.5l4.208 3.5-4.208 3.5zm10.791 1.307L13.5 12l4.083-4.807v9.614z" fill="#007ACC"/></svg>',
    'copilot-cli': '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a3 3 0 110 6 3 3 0 010-6zm-5 11.5a7.5 7.5 0 0110 0" fill="none" stroke="#6e40c9" stroke-width="2"/></svg>',
    'codex': '<svg viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0012 1.002a6.06 6.06 0 00-4.489 2.01 6.04 6.04 0 00-4.005 2.921 6.063 6.063 0 00.735 7.098 5.98 5.98 0 00.516 4.911 6.04 6.04 0 006.51 2.9A6.06 6.06 0 0012 22.998a6.06 6.06 0 004.489-2.01 6.04 6.04 0 004.005-2.92 6.06 6.06 0 00-.735-7.098" fill="#10a37f"/></svg>',
    'qoderwork': '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#6366f1" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>',
};

// === State ===
let currentPage = 1;
let currentFilters = { client: '', q: '', start_time: '', end_time: '' };
let eventSource = null;

// === Theme ===
function initTheme() {
    const saved = localStorage.getItem('telemetry-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : '');
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? '' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('telemetry-theme', next || 'light');
}

// === Router ===
function route() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');

    if (hash.startsWith('#/trace/')) {
        const parts = hash.slice(8).split('/');
        const client = decodeURIComponent(parts[0]);
        const sessionId = parts.slice(1).join('/');
        renderTraceDetail(app, client, sessionId);
    } else {
        renderSessionList(app);
    }
}

// === Session List ===
async function renderSessionList(container) {
    container.innerHTML = '<div class="loading">Loading sessions...</div>';

    const params = new URLSearchParams({
        page: currentPage,
        page_size: 20,
        ...Object.fromEntries(Object.entries(currentFilters).filter(([_, v]) => v))
    });

    try {
        const resp = await fetch('/api/sessions?' + params);
        const data = await resp.json();
        container.innerHTML = buildSessionListHTML(data);
        bindSessionListEvents(container);
    } catch (err) {
        container.innerHTML = '<div class="loading">Error loading sessions: ' + err.message + '</div>';
    }
}

function buildSessionListHTML(data) {
    let html = `
        <div class="filter-bar">
            <select id="filter-client">
                <option value="">All Clients</option>
                <option value="claude-code">Claude Code</option>
                <option value="vscode">VS Code</option>
                <option value="copilot-cli">Copilot CLI</option>
                <option value="codex">Codex</option>
                <option value="qoderwork">Qoderwork</option>
            </select>
            <input type="text" id="filter-search" placeholder="Search prompts, tools..." value="${escapeHtml(currentFilters.q)}">
            <input type="datetime-local" id="filter-start" title="Start time">
            <input type="datetime-local" id="filter-end" title="End time">
        </div>
        <div class="session-list">
    `;

    if (data.sessions.length === 0) {
        html += '<div class="loading">No sessions found</div>';
    }

    for (const session of data.sessions) {
        const logo = CLIENT_LOGOS[session.client] || CLIENT_LOGOS['qoderwork'];
        const startLocal = formatTime(session.start_time);
        const lastLocal = formatTime(session.last_activity);
        const errorBadge = session.has_errors ? '<span class="error-badge">errors</span>' : '';

        html += `
            <div class="session-card" data-client="${escapeHtml(session.client)}" data-session="${escapeHtml(session.session_id)}">
                <div class="client-logo">${logo}</div>
                <div class="card-body">
                    <div class="card-title">
                        ${escapeHtml(session.client)}
                        <span style="color:var(--text-tertiary);font-weight:400;font-size:12px">${escapeHtml(session.session_id.slice(0, 8))}...</span>
                        ${errorBadge}
                    </div>
                    <div class="card-subtitle">Started: ${startLocal} &nbsp;|&nbsp; Last: ${lastLocal} &nbsp;|&nbsp; ${session.span_count} spans, ${session.turn_count} turns</div>
                    <div class="card-preview">${escapeHtml(session.first_prompt_preview)}</div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    html += buildPaginationHTML(data.total, data.page, data.page_size);
    return html;
}

function buildPaginationHTML(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">&lt; Prev</button>`;

    for (let i = 1; i <= Math.min(totalPages, 7); i++) {
        html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Next &gt;</button>`;
    html += '</div>';
    return html;
}

function bindSessionListEvents(container) {
    // Card clicks
    container.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', () => {
            const client = card.dataset.client;
            const session = card.dataset.session;
            window.location.hash = '#/trace/' + encodeURIComponent(client) + '/' + session;
        });
    });

    // Filters
    const clientSelect = container.querySelector('#filter-client');
    const searchInput = container.querySelector('#filter-search');
    const startInput = container.querySelector('#filter-start');
    const endInput = container.querySelector('#filter-end');

    if (clientSelect) {
        clientSelect.value = currentFilters.client;
        clientSelect.addEventListener('change', () => {
            currentFilters.client = clientSelect.value;
            currentPage = 1;
            renderSessionList(container);
        });
    }

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.q = searchInput.value;
                currentPage = 1;
                renderSessionList(container);
            }, 300);
        });
    }

    if (startInput) {
        startInput.addEventListener('change', () => {
            currentFilters.start_time = startInput.value ? new Date(startInput.value).toISOString() : '';
            currentPage = 1;
            renderSessionList(container);
        });
    }

    if (endInput) {
        endInput.addEventListener('change', () => {
            currentFilters.end_time = endInput.value ? new Date(endInput.value).toISOString() : '';
            currentPage = 1;
            renderSessionList(container);
        });
    }

    // Pagination
    container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && !btn.disabled) {
                currentPage = page;
                renderSessionList(container);
            }
        });
    });
}

// === Trace Detail ===
async function renderTraceDetail(container, client, sessionId) {
    container.innerHTML = '<div class="loading">Loading trace...</div>';

    try {
        const resp = await fetch(`/api/sessions/${encodeURIComponent(client)}/${encodeURIComponent(sessionId)}`);
        if (!resp.ok) {
            container.innerHTML = '<div class="loading">Session not found</div>';
            return;
        }
        const data = await resp.json();
        container.innerHTML = buildTraceDetailHTML(data);
        bindTraceDetailEvents(container, data);
    } catch (err) {
        container.innerHTML = '<div class="loading">Error: ' + err.message + '</div>';
    }
}

function buildTraceDetailHTML(data) {
    const logo = CLIENT_LOGOS[data.client] || CLIENT_LOGOS['qoderwork'];
    const flatSpans = flattenTree(data.spans);
    const timeRange = getTimeRange(flatSpans);

    let html = `
        <div class="trace-header">
            <button class="back-btn" onclick="window.location.hash='#/'">&larr; Back</button>
            <span style="display:inline-flex;align-items:center;gap:8px">
                <span style="width:24px;height:24px">${logo}</span>
                <strong>${escapeHtml(data.client)}</strong>
                <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(data.session_id)}</span>
            </span>
        </div>
        <div class="trace-layout">
            <div class="trace-tree" id="trace-tree">
                ${buildTreeHTML(data.spans, 0)}
            </div>
            <div class="trace-timeline" id="trace-timeline">
                <div class="timeline-scale">${buildTimeScale(timeRange)}</div>
                ${buildTimelineHTML(flatSpans, timeRange)}
            </div>
        </div>
        <div class="detail-panel" id="detail-panel" style="display:none">
            <div class="detail-panel-header">
                <span id="detail-title">Span Detail</span>
            </div>
            <div class="detail-panel-body" id="detail-body"></div>
        </div>
    `;
    return html;
}

function buildTreeHTML(spans, depth) {
    let html = '';
    for (const span of spans) {
        const hasChildren = span.children && span.children.length > 0;
        const indent = depth * 20;
        const icon = getSpanIcon(span);
        const label = getSpanLabel(span);
        const duration = span.duration_ms != null ? formatDuration(span.duration_ms) : '';
        const statusClass = span.status === 'failure' ? 'failure' : (span.status === 'success' ? 'success' : '');

        html += `
            <div class="span-item" data-span-id="${escapeHtml(span.span_id)}" style="padding-left:${12 + indent}px">
                <span class="expand-btn">${hasChildren ? '&#9660;' : '&nbsp;'}</span>
                <span class="span-icon" style="color:${getSpanColor(span)}">${icon}</span>
                <span class="span-label">${escapeHtml(label)}</span>
                ${statusClass ? `<span class="span-status-badge ${statusClass}">${span.status}</span>` : ''}
                ${duration ? `<span class="span-duration">${duration}</span>` : ''}
            </div>
        `;
        if (hasChildren) {
            html += `<div class="span-children" data-parent="${escapeHtml(span.span_id)}">`;
            html += buildTreeHTML(span.children, depth + 1);
            html += '</div>';
        }
    }
    return html;
}

function buildTimelineHTML(flatSpans, timeRange) {
    if (!timeRange.duration) return '';
    let html = '';
    for (const span of flatSpans) {
        const start = parseTimestamp(span.start_timestamp);
        const end = parseTimestamp(span.end_timestamp);
        const left = ((start - timeRange.start) / timeRange.duration) * 100;
        const width = Math.max(((end - start) / timeRange.duration) * 100, 0.5);
        const eventClass = span.status === 'failure' ? 'status-failure' : 'event-' + span.event;

        html += `
            <div class="timeline-row">
                <div class="timeline-bar ${eventClass}" data-span-id="${escapeHtml(span.span_id)}"
                     style="left:${left}%;width:${width}%"
                     title="${escapeHtml(getSpanLabel(span))} (${formatDuration(span.duration_ms)})"></div>
            </div>
        `;
    }
    return html;
}

function buildTimeScale(timeRange) {
    if (!timeRange.duration) return '';
    const totalSec = timeRange.duration / 1000;
    const marks = 5;
    let scale = '';
    for (let i = 0; i <= marks; i++) {
        const sec = (totalSec * i / marks).toFixed(1);
        scale += sec + 's' + (i < marks ? '  |  ' : '');
    }
    return scale;
}

function bindTraceDetailEvents(container, data) {
    const flatSpans = flattenTree(data.spans);
    const spanMap = {};
    for (const s of flatSpans) spanMap[s.span_id] = s;

    // Click span in tree or timeline to show detail
    container.querySelectorAll('.span-item, .timeline-bar').forEach(el => {
        el.addEventListener('click', (e) => {
            const spanId = el.dataset.spanId;
            if (!spanId || !spanMap[spanId]) return;

            // Highlight selection
            container.querySelectorAll('.span-item.selected').forEach(s => s.classList.remove('selected'));
            const treeItem = container.querySelector(`.span-item[data-span-id="${spanId}"]`);
            if (treeItem) treeItem.classList.add('selected');

            showSpanDetail(container, spanMap[spanId]);
        });
    });

    // Toggle expand/collapse
    container.querySelectorAll('.span-item .expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.span-item');
            const spanId = item.dataset.spanId;
            const children = container.querySelector(`.span-children[data-parent="${spanId}"]`);
            if (children) {
                const hidden = children.style.display === 'none';
                children.style.display = hidden ? '' : 'none';
                btn.innerHTML = hidden ? '&#9660;' : '&#9654;';
            }
        });
    });
}

function showSpanDetail(container, span) {
    const panel = container.querySelector('#detail-panel');
    const title = container.querySelector('#detail-title');
    const body = container.querySelector('#detail-body');
    panel.style.display = '';

    title.textContent = getSpanLabel(span);
    let html = `
        <div class="detail-section">
            <div class="detail-section-title">Info</div>
            <table style="font-size:13px;width:100%">
                <tr><td style="color:var(--text-secondary);width:120px">Event</td><td>${escapeHtml(span.event)}</td></tr>
                <tr><td style="color:var(--text-secondary)">Span ID</td><td style="font-family:var(--font-mono);font-size:12px">${escapeHtml(span.span_id)}</td></tr>
                <tr><td style="color:var(--text-secondary)">Start</td><td>${formatTime(span.start_timestamp)}</td></tr>
                <tr><td style="color:var(--text-secondary)">End</td><td>${formatTime(span.end_timestamp)}</td></tr>
                ${span.duration_ms != null ? `<tr><td style="color:var(--text-secondary)">Duration</td><td>${formatDuration(span.duration_ms)}</td></tr>` : ''}
                ${span.status ? `<tr><td style="color:var(--text-secondary)">Status</td><td><span class="span-status-badge ${span.status}">${span.status}</span></td></tr>` : ''}
                ${span.error_message ? `<tr><td style="color:var(--text-secondary)">Error</td><td style="color:var(--span-error)">${escapeHtml(span.error_message)}</td></tr>` : ''}
                ${span.request_id ? `<tr><td style="color:var(--text-secondary)">Request ID</td><td style="font-family:var(--font-mono);font-size:12px">${escapeHtml(span.request_id)}</td></tr>` : ''}
                ${span.tool_name ? `<tr><td style="color:var(--text-secondary)">Tool</td><td>${escapeHtml(span.tool_name)}</td></tr>` : ''}
                ${span.skill_name ? `<tr><td style="color:var(--text-secondary)">Skill</td><td>${escapeHtml(span.skill_name)}</td></tr>` : ''}
                ${span.stop_reason ? `<tr><td style="color:var(--text-secondary)">Stop Reason</td><td>${escapeHtml(span.stop_reason)}</td></tr>` : ''}
            </table>
        </div>
    `;

    if (span.prompt) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Prompt</div>
                <div class="detail-json">${escapeHtml(span.prompt)}</div>
            </div>
        `;
    }

    if (span.tool_input) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Input</div>
                <div class="detail-json">${escapeHtml(JSON.stringify(span.tool_input, null, 2))}</div>
            </div>
        `;
    }

    if (span.tool_response != null) {
        const truncatedWarning = span.truncated ? '<div class="truncated-warning">Response truncated (>64KB)</div>' : '';
        const responseText = typeof span.tool_response === 'string'
            ? span.tool_response
            : JSON.stringify(span.tool_response, null, 2);
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Response</div>
                ${truncatedWarning}
                <div class="detail-json">${escapeHtml(responseText)}</div>
            </div>
        `;
    }

    body.innerHTML = html;
}

// === Helpers ===
function flattenTree(spans) {
    const result = [];
    function walk(nodes) {
        for (const node of nodes) {
            result.push(node);
            if (node.children) walk(node.children);
        }
    }
    walk(spans);
    return result;
}

function getTimeRange(spans) {
    if (!spans.length) return { start: 0, end: 0, duration: 0 };
    let min = Infinity, max = -Infinity;
    for (const s of spans) {
        const start = parseTimestamp(s.start_timestamp);
        const end = parseTimestamp(s.end_timestamp);
        if (start < min) min = start;
        if (end > max) max = end;
    }
    return { start: min, end: max, duration: max - min };
}

function parseTimestamp(ts) {
    return ts ? new Date(ts).getTime() : 0;
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString();
}

function formatDuration(ms) {
    if (ms == null) return '';
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return (ms / 60000).toFixed(1) + 'min';
}

function getSpanLabel(span) {
    if (span.event === 'prompt') return span.prompt ? span.prompt.slice(0, 60) : 'prompt';
    if (span.event === 'tool') return span.tool_name || 'tool';
    if (span.event === 'skill_invocation') return span.skill_name || 'skill';
    if (span.event === 'turn_end') return 'turn_end (' + (span.stop_reason || '') + ')';
    return span.event || 'unknown';
}

function getSpanColor(span) {
    if (span.status === 'failure' || span.stop_reason === 'StopFailure') return 'var(--span-error)';
    if (span.event === 'prompt') return 'var(--span-prompt)';
    if (span.event === 'tool') return 'var(--span-tool)';
    if (span.event === 'skill_invocation') return 'var(--span-skill)';
    if (span.event === 'turn_end') return 'var(--span-turn-end)';
    return 'var(--text-secondary)';
}

function getSpanIcon(span) {
    if (span.event === 'prompt') return '&#128172;';
    if (span.event === 'tool') return '&#128295;';
    if (span.event === 'skill_invocation') return '&#9889;';
    if (span.event === 'turn_end') return '&#127937;';
    return '&#9679;';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// === SSE ===
function connectSSE() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/events');

    eventSource.addEventListener('session_updated', (e) => {
        const data = JSON.parse(e.data);
        // If on home page, refresh the list
        if (!window.location.hash || window.location.hash === '#/') {
            renderSessionList(document.getElementById('app'));
        }
    });

    eventSource.addEventListener('new_spans', (e) => {
        const data = JSON.parse(e.data);
        const hash = window.location.hash || '';
        if (hash.includes(data.session_id)) {
            // Re-render trace detail to pick up new spans
            renderTraceDetail(document.getElementById('app'), data.client, data.session_id);
        }
    });

    eventSource.onerror = () => {
        setTimeout(() => connectSSE(), 5000);
    };
}

// === Init ===
function init() {
    initTheme();
    route();
    connectSSE();
    window.addEventListener('hashchange', route);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
```

- [ ] **Step 2: Manual smoke test**

```bash
cd /Users/caihe/projects/ai/alibabacloud-api-mcp-server
python -c "
import asyncio
from alibabacloud.mcp_proxy.telemetry_view import run_telemetry_view
# Just test import works
print('Import OK')
"
```

- [ ] **Step 3: Commit**

```bash
git add src/alibabacloud/mcp_proxy/telemetry_view/static/app.js
git commit -m "feat(telemetry-view): add frontend SPA with session list, trace detail, SSE"
```

---

## Task 8: End-to-End Integration Test

**Files:**
- Modify: `tests/test_telemetry_view_server.py`

- [ ] **Step 1: Add integration test that launches and hits the full server**

Append to `tests/test_telemetry_view_server.py`:
```python
@pytest.mark.asyncio
async def test_index_serves_html(client: TestClient) -> None:
    resp = await client.get("/")
    assert resp.status == 200
    text = await resp.text()
    assert "Telemetry Viewer" in text
    assert "app.js" in text


@pytest.mark.asyncio
async def test_static_css_served(client: TestClient) -> None:
    resp = await client.get("/static/style.css")
    assert resp.status == 200
    text = await resp.text()
    assert "--bg-primary" in text


@pytest.mark.asyncio
async def test_static_js_served(client: TestClient) -> None:
    resp = await client.get("/static/app.js")
    assert resp.status == 200
    text = await resp.text()
    assert "renderSessionList" in text


@pytest.mark.asyncio
async def test_sse_endpoint_returns_event_stream(client: TestClient) -> None:
    resp = await client.get("/api/events")
    assert resp.status == 200
    assert "text/event-stream" in resp.headers.get("Content-Type", "")
```

- [ ] **Step 2: Run all tests**

```bash
pytest tests/test_telemetry_view_data.py tests/test_telemetry_view_watcher.py tests/test_telemetry_view_server.py -v
```

Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_telemetry_view_server.py
git commit -m "test(telemetry-view): add integration tests for static serving and SSE"
```

---

## Task 9: Manual End-to-End Verification with Real Data

- [ ] **Step 1: Run against real trace data**

```bash
cd /Users/caihe/projects/ai/alibabacloud-api-mcp-server
ALIBABACLOUD_TELEMETRY_STATE_DIR=/Users/caihe/projects/ai/test-spec-ops/logs python -m alibabacloud.mcp_proxy.cli telemetry-view --port 18321
```

Expected: Browser opens, shows 2 sessions from the real data. Verify:
- Session cards show claude-code logo
- Start/end times displayed correctly
- First prompt preview shows Chinese text
- Click a session → tree + timeline renders
- Span detail panel shows tool_input/tool_response JSON
- Theme toggle works (light ↔ dark)

- [ ] **Step 2: Test with --no-open flag**

```bash
python -m alibabacloud.mcp_proxy.cli telemetry-view --port 18322 --no-open
```

Expected: Server starts, prints URL, does NOT open browser.

- [ ] **Step 3: Test with custom port**

```bash
python -m alibabacloud.mcp_proxy.cli telemetry-view --port 9876
```

Expected: Server listens on port 9876.

- [ ] **Step 4: Fix any issues found during manual testing, then commit**

```bash
git add -A
git commit -m "fix(telemetry-view): polish from manual testing"
```

---

## Task 10: Final Cleanup & Documentation

- [ ] **Step 1: Run full test suite to ensure no regressions**

```bash
pytest tests/ -v
```

Expected: All existing tests still pass, all new tests pass.

- [ ] **Step 2: Final commit with all changes**

```bash
git status
# If there are any remaining uncommitted changes:
git add -A
git commit -m "feat(telemetry-view): complete telemetry-view local visualization server"
```

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

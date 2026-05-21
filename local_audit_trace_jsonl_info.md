### Local audit trace info

| Event             | When written                                          | Key fields                                                      |
| ----------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| `skill_invocation`| Slash-skill prompt detected (`/alibabacloud-...:skill`) | `tool_name=Skill`, `skill_name`, `plugin_name`                |
| `tool_start`      | PreToolUse for an alibabacloud-related tool            | `tool_name`, `tool_use_id`, `tool_input`                       |
| `tool_end`        | PostToolUse / PostToolUseFailure                       | `status`, `error_message`, `request_id`, `duration_ms`, `tool_response`, `truncated` |
| `prompt`          | Backfilled at Stop when the turn had alibabacloud activity | sanitized `prompt` text, full `start_timestamp` … `end_timestamp` span |
| `turn_end`        | Always at Stop when the turn had alibabacloud activity | `stop_reason` (`Stop` / `StopFailure`)                          |

All events share `span_id`, `parent_span_id`, `turn`, `session_id`, and
`client`. The `prompt` event is the root span of each turn (`parent_span_id: null`); every other event in the same turn references it as parent.
Responses larger than 64 KB are truncated and tagged `"truncated": true`.
Light sanitization is applied (AK/SK, STS tokens, JWT, PEM keys,
`accessKeySecret=…`, CN mobile, email).

#### JSONL record field reference

**Common fields** (present on every event):

| Field             | Type     | Description                                                              |
| ----------------- | -------- | ------------------------------------------------------------------------ |
| `event`           | `string` | Event type. Enum: `prompt`, `skill_invocation`, `tool_start`, `tool_end`, `turn_end` |
| `span_id`         | `string` | Unique span identifier for this event                                    |
| `parent_span_id`  | `string \| null` | Parent span ID. `null` only for `prompt` (root span)            |
| `turn`            | `int`    | Zero-based turn counter within the session                               |
| `start_timestamp` | `string` | ISO 8601 with milliseconds, e.g. `2026-05-20T01:48:59.649Z`             |
| `end_timestamp`   | `string` | ISO 8601 with milliseconds                                               |
| `session_id`      | `string` | Claude Code session UUID                                                  |
| `client`          | `string` | Enum: `claude-code`, `vscode`, `copilot-cli`, `codex`, `qoderwork`       |

**`prompt` event** (backfilled at Stop):

| Field    | Type     | Description                                             |
| -------- | -------- | ------------------------------------------------------- |
| `prompt` | `string` | User prompt text (sanitized — credentials replaced with `***`) |

**`skill_invocation` event** (slash-skill `/alibabacloud-*:*`):

| Field         | Type     | Description                                                      |
| ------------- | -------- | ---------------------------------------------------------------- |
| `tool_name`   | `string` | Always `"Skill"`                                                 |
| `skill_name`  | `string` | Qualified skill name, e.g. `alibabacloud-core:alibabacloud-sdk-usage` |
| `plugin_name` | `string` | Plugin prefix, e.g. `alibabacloud-core`                          |
| `status`      | `string` | Always `"success"`                                               |

**`tool_start` event** (PreToolUse):

| Field         | Type           | Description                                                    |
| ------------- | -------------- | -------------------------------------------------------------- |
| `tool_name`   | `string`       | Full MCP tool name, e.g. `mcp__plugin_alibabacloud-core_alibabacloud-core__AlibabaCloud___CallCLI` |
| `tool_use_id` | `string`       | Claude-assigned tool use ID, e.g. `toolu_bdrk_01...`           |
| `tool_input`  | `object`       | Tool call parameters (sanitized)                               |

**`tool_end` event** (PostToolUse / PostToolUseFailure):

| Field           | Type             | Description                                                          |
| --------------- | ---------------- | -------------------------------------------------------------------- |
| `tool_name`     | `string`         | Same as in `tool_start`                                              |
| `tool_use_id`   | `string`         | Same as in `tool_start`                                              |
| `status`        | `string`         | Enum: `success`, `failure`                                           |
| `error_message` | `string \| null` | Classified error code when `status=failure`, e.g. `NoPermission`, `Throttling` |
| `request_id`    | `string \| null` | Alibaba Cloud `RequestId` extracted from response (if present)       |
| `duration_ms`   | `int`            | Wall-clock duration from `tool_start` to `tool_end` in milliseconds  |
| `tool_response` | `array \| string \| null` | Full response body (sanitized). Truncated to string if > 64 KB |
| `truncated`     | `bool`           | `true` if `tool_response` was truncated due to > 64 KB size          |

**`turn_end` event** (Stop / StopFailure):

| Field         | Type     | Description                                              |
| ------------- | -------- | -------------------------------------------------------- |
| `stop_reason` | `string` | Enum: `Stop`, `StopFailure`                              |

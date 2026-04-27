# Alibaba Cloud MCP Proxy 使用说明

Alibaba Cloud MCP Proxy 是一个本地 stdio MCP 代理，用于连接阿里云 OpenAPI MCP Server。它负责在本地处理认证、连接管理、重试和安全策略，让 Claude Desktop、Cursor 等 MCP 客户端可以通过本地静态凭证直接接入阿里云 API MCP Server。

## 前置权限

运行代理的 RAM 用户或角色需要具备以下权限：

阿里云已支持系统权限策略 `AliyunOpenAPIMCPServerStaticCredentialAccess`（Access 全量权限，表示通过静态凭证连接权限）。

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ram:GenerateAccessToken",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "openapiexplorer:*",
      "Resource": "*"
    }
  ]
}
```

- `ram:GenerateAccessToken`：用于通过 IMS 获取 Bearer Token。
- `openapiexplorer:*`：用于发现 MCP Server 和调用工具。

## 快速开始

通过 `uvx` 直接运行最新版代理：

```bash
uvx alibabacloud.mcp-proxy@latest
```

如果需要指定自定义 MCP Server 地址：

```bash
uvx alibabacloud.mcp-proxy@latest --server-url <YOUR_MCP_SERVER_URL>
```

## MCP 客户端配置

在 Claude Desktop、Cursor 等 MCP 客户端配置中添加：

```json
{
  "mcpServers": {
    "alibabacloud": {
      "command": "uvx",
      "args": ["alibabacloud.mcp-proxy@latest"]
    }
  }
}
```

代理会读取本地阿里云静态凭证，并自动换取连接远端 OpenAPI MCP Server 所需的访问令牌。

## 本地静态凭证登录

现在阿里云 API MCP Server 可以通过本地静态凭证直接登录。你可以使用阿里云 CLI 或环境变量配置本地凭证，MCP Proxy 会在本地读取凭证并调用 IMS `GenerateAccessToken` 获取 Bearer Token，无需在 MCP 客户端中手动维护 OAuth Token。

常见环境变量配置方式：

```bash
export ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key_id
export ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_access_key_secret
uvx alibabacloud.mcp-proxy@latest
```

## 安全策略

可以通过 `--safety-policy` 限制允许调用的 MCP 工具。安全策略会在连接上游 MCP Server 前应用到访问令牌上。

例如只允许 ECS 查询类操作：

```bash
uvx alibabacloud.mcp-proxy@latest --safety-policy "ecs:describe-*=allow,*=deny"
```

MCP 客户端配置示例：

```json
{
  "mcpServers": {
    "alibabacloud": {
      "command": "uvx",
      "args": [
        "alibabacloud.mcp-proxy@latest",
        "--safety-policy", "ecs:describe-*=allow,*=deny"
      ]
    }
  }
}
```

也可以使用环境变量：

```bash
export ALIBABACLOUD_MCP_SAFETY_POLICY="ecs:describe-*=allow,*=deny"
uvx alibabacloud.mcp-proxy@latest
```

## 预检查

连接上游 MCP Server 前，可以使用 `pre-check` 检查本地 OAuth 应用是否正确安装和授权：

```bash
uvx alibabacloud.mcp-proxy@latest pre-check
```

国际站：

```bash
uvx alibabacloud.mcp-proxy@latest pre-check --site-type INTL
```

指定自定义 OAuth Client ID：

```bash
uvx alibabacloud.mcp-proxy@latest pre-check --client-id YOUR_OAUTH_CLIENT_ID
```

## 配置参考

每个 CLI 参数都有对应的环境变量。CLI 参数优先级高于环境变量。

### 连接配置

| CLI 参数 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| `--server-url` | `ALIBABACLOUD_MCP_SERVER_URL` | 自动发现 | 上游 Alibaba Cloud MCP Streamable HTTP URL。未设置时会通过 `ListApiMcpServerCores` OpenAPI 自动发现。 |
| `--site-type` | `ALIBABACLOUD_MCP_SITE_TYPE` | `CN` | 站点类型：`CN` 中国站，`INTL` 国际站。 |
| `--connect-timeout` | `ALIBABACLOUD_MCP_CONNECT_TIMEOUT` | `10.0` | HTTP 连接超时时间，单位秒。 |
| `--read-timeout` | `ALIBABACLOUD_MCP_READ_TIMEOUT` | `120.0` | HTTP 读取超时时间，单位秒。 |

### 认证配置

| CLI 参数 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| `--bearer-token` | `ALIBABACLOUD_MCP_BEARER_TOKEN` | - | 显式指定上游 MCP Server 的 Bearer Token。 |
| `--token-command` | `ALIBABACLOUD_MCP_TOKEN_COMMAND` | - | 输出 Bearer Token 或包含 `access_token` 的 JSON 的命令。 |
| `--client-id` | `ALIBABACLOUD_MCP_CLIENT_ID` | 按站点选择 | IMS `GenerateAccessToken` ClientId。 |
| `--scope` | `ALIBABACLOUD_MCP_SCOPE` | `/internal/acs/openapi` | IMS `GenerateAccessToken` Scope。 |
| `--ims-endpoint` | `ALIBABACLOUD_MCP_IMS_ENDPOINT` | 按站点选择 | IMS API Endpoint。 |

### 调试和日志

| CLI 参数 | 环境变量 | 默认值 | 说明 |
|---|---|---|---|
| `--debug` | `ALIBABACLOUD_MCP_DEBUG` | `false` | 启用 debug 日志，必须同时设置 `--log-file`。 |
| `--log-file` | `ALIBABACLOUD_MCP_LOG_FILE` | - | 日志文件路径。 |

## 运行要求

- Python >= 3.13

## License

Apache-2.0

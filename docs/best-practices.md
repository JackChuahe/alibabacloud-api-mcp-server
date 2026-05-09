# OpenAPI MCP Server Core 最佳实践

本文将介绍如何使用阿里云 `OpenAPI MCP Server Core`，并结合 `Skill` 与 `safety policy`，构建高效、安全、适合生产环境的 Agent 集成方案。

`OpenAPI MCP Server Core` 是阿里云提供的泛化版本远程 MCP Server。与自定义版不同，Core 版无需预先选择 API，而是通过内置工具组合覆盖全部阿里云 OpenAPI，更适合探索式调用、跨产品联动以及通用型 Agent 集成场景。

## 适用场景

`OpenAPI MCP Server Core` 适用于以下场景：

* 希望让 Agent 直接通过自然语言操作阿里云资源。
* 业务涉及多个云产品，需要动态检索 API，而不是预先固定工具集合。
* 希望在开发阶段快速验证 Agent 与阿里云 OpenAPI 的集成效果。
* 希望在生产环境中结合 `Skill` 与安全策略，将 Agent 可调用范围控制在预期边界内。

## Core 版能力说明

根据阿里云 OpenAPI MCP Server 文档，Core 版登录后即可自动分配 MCP 服务端点，并通过内置工具组合覆盖全部阿里云 OpenAPI。当前常用工具如下：

```bash
AlibabaCloud___SearchApis
AlibabaCloud___CallCLI
AlibabaCloud___GetApiDefinition
AlibabaCloud___ListApis
AlibabaCloud___ListProductRegions
AlibabaCloud___GenerateCLICommand
AlibabaCloud___ListProducts
AlibabaCloud___SearchDocument
AlibabaCloud___ReadDocument
```

各工具作用如下：

* `AlibabaCloud___SearchApis`：通过自然语言检索需求对应的 API。
* `AlibabaCloud___CallCLI`：远程执行单条 CLI 命令，不支持管道等 Shell 组合操作。
* `AlibabaCloud___GetApiDefinition`：通过 API 三元组查询 API 定义，包括入参、出参和文档信息。
* `AlibabaCloud___ListApis`：查询指定产品下的 API 列表。
* `AlibabaCloud___ListProductRegions`：查询产品支持的地域列表。
* `AlibabaCloud___GenerateCLICommand`：根据 API 三元组和参数结构规则化生成 CLI 调用命令。
* `AlibabaCloud___ListProducts`：查询阿里云支持的全部产品列表。
* `AlibabaCloud___SearchDocument`：通过自然语言检索阿里云文档中心内容。
* `AlibabaCloud___ReadDocument`：读取指定阿里云文档链接的详细内容。

## 推荐使用方式

在选择 `OpenAPI MCP Server` 时，建议优先区分 Core 版与自定义版的适用边界：

* 如果希望快速上手，并覆盖全部阿里云 OpenAPI，建议使用 Core 版。
* 如果已经明确所需 API，希望将固定 API 直接暴露为 Tool，建议使用自定义版。

对于多数 Agent 集成场景，推荐先使用 Core 版完成探索、验证与 Skill 打磨，再根据实际业务边界决定是否切换到自定义版，或继续保留 Core 版作为通用能力底座。

## 连接方式

阿里云 `OpenAPI MCP Server` 支持标准 OAuth 服务发现，可基于 Web Flow 完成登录授权。对于桌面客户端或具备浏览器交互能力的环境，建议优先使用 OAuth 认证。

如果是程序化集成，也可以使用本地代理模式，配置文档可参考：
[README-PROXY.md](https://github.com/aliyun/alibabacloud-api-mcp-server/blob/main/README-PROXY.md)

最简配置示例如下：

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

如果本地已经安装阿里云 CLI 并完成登录，则可直接复用本地凭据，读取当前用户自己的 `MCP Server Core` 并完成连接。这种方式适合本地开发、CLI 环境以及程序化接入场景。

## 安全策略

在生产环境中，建议不要仅依赖账号本身的权限边界，还应进一步约束 Agent 通过 `MCP Core` 可执行的操作范围。

`MCP Core` 支持对连接使用的 bearer token 配置 `safety policy`，用于限制 Agent 通过 MCP 通道能够调用的 CLI 范围。这样可以在不改变账号原有权限的前提下，将 Agent 的实际可执行面收敛到指定的 CLI 子命令集合。

例如：

```json
{
  "mcpServers": {
    "terraform-usage": {
      "command": "uvx",
      "args": [
        "alibabacloud.mcp-proxy@latest",
        "--safety-policy",
        "iacservice:*=allow,*=deny"
      ]
    }
  }
}
```

在上述配置下，当前 Agent 通过 `MCP Core` 执行 CLI 调用时，仅允许调用 `iacservice` 下的子命令，其他命令均会被拒绝，且无法绕过。

对于生产环境，建议将 `safety policy` 与业务 `Skill` 一起设计：先将任务路径收敛为稳定的 CLI 调用集合，再将这部分调用集合转换为对应的安全策略，从而同时实现执行效率与调用边界可控。

## 最佳实践路径

建议开发者按照"先收敛能力，再开放执行"的方式集成 `MCP Core`。

### 一. 先用 Core 版完成 API 探索

在需求尚不稳定时，可先通过 `AlibabaCloud___SearchApis`、`AlibabaCloud___GetApiDefinition`、`AlibabaCloud___SearchDocument` 等工具确认：

* 目标操作对应哪一个 API。
* API 的入参与返回结构是否符合业务预期。
* 是否存在更合适的产品接口、地域限制或权限要求。

这一阶段适合沉淀 Prompt、Tool 调用链路与异常处理方式。

### 二. 将高频调用收敛为 Skill

当某类任务的调用路径已经稳定后，建议将探索得到的 API 调用流程固化到 Skill 中。推荐做法如下：

1. 使用 `AlibabaCloud___SearchApis` 确认目标 API。
2. 使用 `AlibabaCloud___GenerateCLICommand` 将 API 调用转换为规则化 CLI 命令。
3. 将命令调用逻辑、参数约束、错误处理方式写入 Skill。
4. 对 Skill 进行完整联调与测试。

这样可以避免 Agent 在每次执行时重复做大范围 API 搜索，缩短任务执行路径，并提升稳定性。

### 三. 将 Skill 所需调用转换为 Safety Policy

当 Skill 所需的 CLI 调用集合确定后，建议将其转换为 `safety policy`。这样可以实现：

* `Skill` 负责提升执行效率。
* `Safety Policy` 负责约束执行边界。
* `MCP Core` 负责提供通用检索与调用能力。

这种组合方式既保留了 Core 版的泛化能力，又能在生产环境中控制 Agent 的实际可操作面。

### 四. 在生产环境中组合使用

在生产环境中，推荐按以下方式组合：

* 使用 `OpenAPI MCP Server Core` 作为泛化能力底座。
* 使用 `Skill` 固化高频业务路径。
* 使用 `safety policy` 限制调用范围。
* 使用最小权限 RAM 身份承载实际调用。

## 典型应用场景

建议开发者组合 `Skill` 和 `MCP Core` 工具，以最短路径让 Agent 完成和阿里云的集成。推荐按照以下步骤实施：

1. 先准备一个 `Skill`，结合自身场景通过 `AlibabaCloud___SearchApis` 确认所需接口。
2. 将确认后的接口转换为 CLI 调用，并整理到 `Skill` 中。
3. 对整个 `Skill` 做完整测试，确认调用链路、参数约束和返回结果符合预期。
4. 将 `Skill` 中需要使用的 CLI 调用进一步转换为 `safety policy`。
5. 在生产环境中组合 `Skill`、`MCP Core` 和 `safety policy`，实现 Agent 高效、安全地集成阿里云能力。

## 注意事项

* Core 版覆盖范围广，更适合探索和联动，也更需要在生产环境中做好调用边界控制。
* 建议优先使用 RAM 用户或 RAM 角色，并遵循最小权限原则。
* 对于稳定业务场景，建议优先通过 `Skill` 固化调用路径，而不是在每次执行时都依赖大范围动态搜索。
* 对于生产环境，建议始终为 Agent 配置明确的 `safety policy`。

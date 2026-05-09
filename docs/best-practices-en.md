# OpenAPI MCP Server Core Best Practices

This guide introduces how to use Alibaba Cloud `OpenAPI MCP Server Core`, combined with `Skill` and `safety policy`, to build an efficient, secure, and production-ready Agent integration solution.

`OpenAPI MCP Server Core` is a generalized remote MCP Server provided by Alibaba Cloud. Unlike the custom version, the Core version does not require pre-selecting APIs. Instead, it covers all Alibaba Cloud OpenAPIs through a built-in tool combination, making it more suitable for exploratory calls, cross-product orchestration, and general-purpose Agent integration scenarios.

## Applicable Scenarios

`OpenAPI MCP Server Core` is suitable for the following scenarios:

* You want the Agent to operate Alibaba Cloud resources directly through natural language.
* Your business involves multiple cloud products and requires dynamic API discovery rather than a pre-fixed tool set.
* You want to quickly validate the integration between Agent and Alibaba Cloud OpenAPI during development.
* You want to combine `Skill` and safety policies in production to keep the Agent's callable scope within expected boundaries.

## Core Version Capabilities

According to the Alibaba Cloud OpenAPI MCP Server documentation, the Core version automatically assigns an MCP service endpoint after login and covers all Alibaba Cloud OpenAPIs through a built-in tool combination. The commonly used tools are as follows:

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

Each tool serves the following purpose:

* `AlibabaCloud___SearchApis`: Search for APIs matching requirements using natural language.
* `AlibabaCloud___CallCLI`: Execute a single CLI command remotely. Does not support shell composition such as pipes.
* `AlibabaCloud___GetApiDefinition`: Query API definitions by API triplet, including input parameters, output parameters, and documentation.
* `AlibabaCloud___ListApis`: List all APIs under a specified product.
* `AlibabaCloud___ListProductRegions`: Query the list of regions supported by a product.
* `AlibabaCloud___GenerateCLICommand`: Generate a normalized CLI command based on the API triplet and parameter structure.
* `AlibabaCloud___ListProducts`: List all products supported by Alibaba Cloud.
* `AlibabaCloud___SearchDocument`: Search Alibaba Cloud documentation center content using natural language.
* `AlibabaCloud___ReadDocument`: Read detailed content of a specified Alibaba Cloud documentation link.

## Recommended Usage

When choosing an `OpenAPI MCP Server`, it is recommended to first distinguish the applicable boundaries between the Core version and the custom version:

* If you want to get started quickly and cover all Alibaba Cloud OpenAPIs, use the Core version.
* If you have already identified the required APIs and want to expose fixed APIs directly as Tools, use the custom version.

For most Agent integration scenarios, it is recommended to use the Core version first to complete exploration, validation, and Skill refinement, then decide whether to switch to the custom version based on actual business boundaries, or continue using the Core version as a general-purpose capability base.

## Connection Methods

Alibaba Cloud `OpenAPI MCP Server` supports standard OAuth service discovery and can complete login authorization based on Web Flow. For desktop clients or environments with browser interaction capabilities, OAuth authentication is recommended.

For programmatic integration, you can also use the local proxy mode. For configuration documentation, refer to:
[README-PROXY.md](https://github.com/aliyun/alibabacloud-api-mcp-server/blob/main/README-PROXY.md)

The simplest configuration example is as follows:

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

If the Alibaba Cloud CLI is already installed and logged in locally, you can directly reuse local credentials to read the current user's own `MCP Server Core` and complete the connection. This approach is suitable for local development, CLI environments, and programmatic integration scenarios.

## Safety Policy

In production environments, it is recommended not to rely solely on the account's permission boundaries, but to further constrain the scope of operations that the Agent can perform through `MCP Core`.

`MCP Core` supports configuring a `safety policy` for the bearer token used in the connection, which limits the CLI scope that the Agent can invoke through the MCP channel. This allows you to narrow the Agent's actual executable surface to a specified set of CLI subcommands without changing the account's original permissions.

For example:

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

With the above configuration, when the current Agent executes CLI calls through `MCP Core`, only subcommands under `iacservice` are allowed. All other commands will be rejected and cannot be bypassed.

For production environments, it is recommended to design the `safety policy` together with business `Skill`: first converge the task path into a stable set of CLI calls, then convert this set into a corresponding safety policy, thereby achieving both execution efficiency and controllable call boundaries.

## Best Practice Path

Developers are advised to integrate `MCP Core` following the approach of "converge capabilities first, then open execution."

### Step 1: Complete API Exploration with Core Version

When requirements are not yet stable, use tools such as `AlibabaCloud___SearchApis`, `AlibabaCloud___GetApiDefinition`, and `AlibabaCloud___SearchDocument` to confirm:

* Which API corresponds to the target operation.
* Whether the API's input parameters and return structure meet business expectations.
* Whether there are more suitable product interfaces, region restrictions, or permission requirements.

This stage is suitable for refining Prompts, Tool call chains, and exception handling approaches.

### Step 2: Converge High-Frequency Calls into Skills

Once the call path for a certain type of task has stabilized, it is recommended to solidify the explored API call flow into a Skill. The recommended approach is:

1. Use `AlibabaCloud___SearchApis` to confirm the target API.
2. Use `AlibabaCloud___GenerateCLICommand` to convert the API call into a normalized CLI command.
3. Write the command call logic, parameter constraints, and error handling into the Skill.
4. Perform complete integration testing on the Skill.

This avoids the Agent repeatedly performing broad API searches during each execution, shortens the task execution path, and improves stability.

### Step 3: Convert Skill-Required Calls into Safety Policy

Once the set of CLI calls required by the Skill is determined, it is recommended to convert them into a `safety policy`. This achieves:

* `Skill` is responsible for improving execution efficiency.
* `Safety Policy` is responsible for constraining execution boundaries.
* `MCP Core` is responsible for providing general search and invocation capabilities.

This combination retains the generalization capability of the Core version while controlling the Agent's actual operable surface in production environments.

### Step 4: Combine in Production Environment

In production environments, the following combination is recommended:

* Use `OpenAPI MCP Server Core` as the generalized capability base.
* Use `Skill` to solidify high-frequency business paths.
* Use `safety policy` to restrict the call scope.
* Use a least-privilege RAM identity to carry actual calls.

## Typical Application Scenarios

Developers are advised to combine `Skill` and `MCP Core` tools to enable the Agent to complete Alibaba Cloud integration in the shortest path. The recommended steps are:

1. Prepare a `Skill` and use `AlibabaCloud___SearchApis` to confirm the required interfaces for your scenario.
2. Convert the confirmed interfaces into CLI calls and organize them into the `Skill`.
3. Perform complete testing on the entire `Skill` to confirm that the call chain, parameter constraints, and return results meet expectations.
4. Further convert the CLI calls used in the `Skill` into a `safety policy`.
5. Combine `Skill`, `MCP Core`, and `safety policy` in the production environment to enable the Agent to integrate Alibaba Cloud capabilities efficiently and securely.

## Notes

* The Core version has broad coverage, making it more suitable for exploration and orchestration, but also requiring better call boundary control in production environments.
* It is recommended to prioritize RAM users or RAM roles and follow the principle of least privilege.
* For stable business scenarios, it is recommended to solidify call paths through `Skill` rather than relying on broad dynamic searches during each execution.
* For production environments, it is always recommended to configure an explicit `safety policy` for the Agent.

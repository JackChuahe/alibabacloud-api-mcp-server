# Alibaba Cloud MCP Server User Guide

## [README of Chinese](README.md)

## 📚 Table of Contents

- [Overview](#overview)
- [Deployment Modes](#deployment-modes)
  - [Remote Mode](#remote-mode)
  - [Local Mode](#local-mode)
- [Remote Mode Details](#remote-mode-details)
  - [Technical Specifications](#technical-specifications)
  - [Access Endpoints](#access-endpoints)
  - [System MCP Service List](#system-mcp-service-list)
    - [Infrastructure Management](#infrastructure-management)
    - [Monitoring & Auditing](#monitoring--auditing)
    - [Compliance & Governance](#compliance--governance)
  - [Core Capabilities](#core-capabilities)
    - [OpenAPI Customization & Optimization](#openapi-customization--optimization)
    - [Terraform As Tools](#terraform-as-tools)
    - [Multi-Account Support](#multi-account-support)
    - [Custom OAuth](#custom-oauth)
- [Local Mode Details](#local-mode-details)
  - [Operating Mechanism](#operating-mechanism)
  - [Service List](#service-list)
    - [Database Services](#database-services)
    - [Data Analytics Services](#data-analytics-services)
    - [DevOps Services](#devops-services)
    - [Other Services](#other-services)
- [Quick Start](#quick-start)
  - [Remote Mode Access](#remote-mode-access)
  - [Access with Local Static Credentials](#access-with-local-static-credentials)
  - [Local Mode Deployment](#local-mode-deployment)
- [Reference Documentation](#reference-documentation)

## Overview

Alibaba Cloud MCP Server is a powerful cloud service integration platform that provides seamless integration capabilities for Alibaba Cloud services to AI applications through the Model Context Protocol (MCP). The platform supports tens of thousands of Alibaba Cloud OpenAPIs, enabling developers to easily integrate various Alibaba Cloud service capabilities into AI workflows.

## Deployment Modes

### Remote Mode

Use the full range of Alibaba Cloud services through the officially hosted Alibaba Cloud OpenAPI MCP Server without local deployment. Suitable for scenarios requiring rapid integration and low maintenance costs.

Alibaba Cloud now provides API MCP Server Core. This mode follows a remote CLI pattern, enabling orchestration of the full Alibaba Cloud capability surface with a single-digit number of core tools (covering tens of thousands of OpenAPIs).

### Local Mode

Based on stdio process mode, running MCP Server locally. Suitable for scenarios with high data security requirements and need for custom configuration.

## Remote Mode Details

### Technical Specifications

- **Core Mode**: API MCP Server Core (remote CLI mode)
- **Supported Protocols**: SSE (Server-Sent Events), Streamable HTTP
- **Authentication Method**: OAuth 2.0
- **API Count**: Supports tens of thousands of Alibaba Cloud OpenAPIs
- **Deployment Method**: Cloud-hosted, zero maintenance

### Access Endpoints

| Region | Access Endpoint | Applicable Scenarios |
|--------|----------------|---------------------|
| **China Site** | https://api.aliyun.com/mcp | Users in mainland China |
| **International Site** | https://api.alibabacloud.com/mcp | Overseas and international users |

### System MCP Service List

Alibaba Cloud officially provides a series of carefully optimized system MCP services, optimized for specific scenarios:

#### Infrastructure Management

| Service Name | Function Description |
|-------------|---------------------|
| **Terraform Provider** | Provides Alibaba Cloud Terraform Provider metadata, supports online validation and runtime capabilities for executing Terraform commands |
| **Quota Center** | Query general quota information for products supported by the Quota Center based on cloud product name, quota description, regional information, etc. |
| **Resource Search** | Supports search and statistics functions for resources with permissions under the current account |

#### Monitoring & Auditing

| Service Name | Function Description |
|-------------|---------------------|
| **ActionTrail AI** | Uses AI to flexibly call the ActionTrail LookupEvents interface based on scenarios |
| **Permission Diagnostics** | When API requests are rejected due to lack of permissions, perform permission diagnosis through EncodedDiagnosticMessage |

#### Compliance & Governance

| Service Name | Function Description |
|-------------|---------------------|
| **Governance Report** | MCP Server based on GovernanceReport |
| **Config Compliance Pack** | Query compliance pack templates, enable specified compliance packs, query risk overview and risk resource inventory |

### Core Capabilities

#### OpenAPI Customization & Optimization

- Modify API descriptions to make them more suitable for AI understanding
- Simplify non-required parameters to reduce calling complexity
- Optimize parameter descriptions to improve AI calling accuracy

#### Terraform As Tools

- **HCL Code Integration**: Introduce Terraform HCL code as complete tools
- **Automatic Variable Parsing**: Terraform variables automatically convert to tool parameters
- **Deterministic Orchestration**: Achieve deterministic deployment and management of infrastructure

#### Multi-Account Support

- **Role Assumption**: Automatically use role assumption capabilities to operate specific accounts
- **Account Switching**: Flexibly specify operation accounts and assumed roles
- **Centralized Management**: Easily achieve multi-account AI integrated management

#### Custom OAuth

- **Callback Whitelist**: Precisely control callback address whitelist
- **Token Lifecycle**: Flexibly set access token and refresh token expiration times
- **Long-term Login-free**: Achieve up to 1 year of login-free operation

## Local Mode Details

### Operating Mechanism

Local mode is based on stdio process communication, with MCP Server running as an independent process locally, communicating with AI applications through standard input/output.

### Service List

#### Database Services

| Service | Repository URL | Description |
|---------|---------------|-------------|
| **DMS** | [alibabacloud-dms-mcp-server](https://github.com/aliyun/alibabacloud-dms-mcp-server) | Data Management Service, provides database management capabilities |
| **RDS** | [alibabacloud-rds-openapi-mcp-server](https://github.com/aliyun/alibabacloud-rds-openapi-mcp-server) | Relational Database Service OpenAPI integration |
| **ADBPG** | [alibabacloud-adbpg-mcp-server](https://github.com/aliyun/alibabacloud-adbpg-mcp-server) | AnalyticDB for PostgreSQL |

#### Data Analytics Services

| Service | Repository URL | Description |
|---------|---------------|-------------|
| **DataWorks** | [alibabacloud-dataworks-mcp-server](https://github.com/aliyun/alibabacloud-dataworks-mcp-server) | Data Factory, provides big data development and governance capabilities |

#### DevOps Services

| Service | Repository URL | Description |
|---------|---------------|-------------|
| **Apsara DevOps** | [alibabacloud-devops-mcp-server](https://github.com/aliyun/alibabacloud-devops-mcp-server) | Enterprise-level DevOps platform integration |
| **Operations Development** | [alibaba-cloud-ops-mcp-server](https://github.com/aliyun/alibaba-cloud-ops-mcp-server) | Operations development tools integration |

#### Other Services

| Service | Repository URL | Description |
|---------|---------------|-------------|
| **ESA** | [mcp-server-esa](https://github.com/aliyun/mcp-server-esa) | Edge Security Acceleration service |
| **Observability** | [alibabacloud-observability-mcp-server](https://github.com/aliyun/alibabacloud-observability-mcp-server) | Observability service integration |

## Quick Start

### Remote Mode Access

1. **Access Console**
   - China Site users visit: https://api.aliyun.com/mcp
   - International Site users visit: https://api.alibabacloud.com/mcp

2. **OAuth Authentication**
   - Configure OAuth application
   - Obtain Access Token
   - Configure Token refresh strategy

3. **Select Services**
   - Browse system MCP services
   - Select required OpenAPI
   - Customize API parameters

### Access with Local Static Credentials

Alibaba Cloud API MCP Server now supports direct login through local static credentials. You can configure an Alibaba Cloud AccessKey or an existing local credential profile, then use Alibaba Cloud MCP Proxy to automatically exchange it for the token required by OpenAPI MCP Server. This removes the need to manually maintain OAuth tokens in MCP client configuration.

For proxy installation, MCP client configuration, safety policies, and pre-check usage, see: [Alibaba Cloud MCP Proxy User Guide](README-PROXY-EN.md).

### Local Mode Deployment

1. **Clone Repository**
   ```bash
   git clone https://github.com/aliyun/[specific-service-repository-name]
   cd [repository-directory]
   ```

2. **Install Dependencies**
   ```bash
   npm install  # or yarn install
   ```

3. **Configure Authentication**
   ```bash
   export ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key
   export ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_secret_key
   ```

4. **Start Service**
   ```bash
   npm start  # or follow the specific repository's startup instructions
   ```

## Reference Documentation

- 📖 **Official Documentation**: [OpenAPI MCP Server User Guide](https://www.alibabacloud.com/help/en/openapi/user-guide/openapi-mcp-server-guide)
- 🔧 **Technical Support**: Get technical support through Alibaba Cloud ticket system or official forums
- 💬 **Community Exchange**: Join the Alibaba Cloud Developer Community for discussions, DingTalk Group: 136325002292

---

*This document is continuously updated. Welcome to submit Issues or PRs to contribute content*

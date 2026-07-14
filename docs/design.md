# QubuiFS-Web 设计草案

## 目标

QubuiFS-Web 是 QubuiFS 管理面的浏览器控制台。用户进入 Web 后必须先输入控制面 REST 端点，Web 完成握手并确认控制面可用后，才进入管理界面；握手失败或会话失效时，页面保持在初始化状态。

首版目标是作为管理面 OpenAPI 的前端实现入口，覆盖连接初始化、控制面状态展示、QubuiFS 实例管理、节点管理、数据设备管理和元数据导出。后端功能未完成的接口仍可在 UI 中预留入口，但必须显示真实的不可用状态，不把 `NotImplemented` 包装成成功。

## 运行形态

- [ ] Web 以容器运行，对外暴露一个 HTTP 端口。
- [ ] 容器内包含静态前端和轻量 Web 网关。
- [ ] 浏览器只访问 Web 容器，不直接跨域访问控制面端点。
- [ ] Web 网关负责控制面握手、会话保存、请求转发和错误归一化。
- [ ] 控制面端点由用户在初始化页输入，例如 `http://10.0.0.12:9983`。

推荐形态：

```text
Browser
  |
  | HTTP
  v
QubuiFS-Web container
  - static frontend
  - web gateway / API proxy
  |
  | HTTP to selected control-plane endpoint
  v
QubuiFS control plane REST API
```

## 页面状态机

```text
INIT -> HANDSHAKING -> CONNECTED
  ^          |              |
  |          v              v
  +------ FAILED <------ DISCONNECTED
```

- `INIT`：默认状态，只显示控制面端点输入框和连接按钮。
- `HANDSHAKING`：用户提交端点后，Web 网关探测控制面。
- `CONNECTED`：握手成功，进入管理界面。
- `FAILED`：握手失败，展示失败原因，仍停留初始化页。
- `DISCONNECTED`：已连接会话后续探测失败或用户主动断开，退回初始化页。

管理页面加载前必须满足：

- [ ] 当前浏览器会话存在有效控制面端点。
- [ ] 最近一次握手成功。
- [ ] 网关能够通过该端点访问控制面 `GET /healthz`。

## 初始化与握手

初始化页输入内容：

- [ ] 控制面端点：必填，要求包含协议和 host，可带端口。
- [ ] 可选显示名称：用于区分多个环境，首版可以不持久化。

握手流程：

1. 前端调用 Web 网关 `POST /api/session/connect`。
2. 网关校验端点格式，只允许 `http://` 或 `https://`。
3. 网关请求控制面 `GET /healthz`，要求 HTTP 可达且响应 `code=0`、`data.status=ok`。
4. 网关请求 `GET /version`，用于展示版本信息；失败不阻断首版连接，但需要在页面标识未知。
5. 网关请求 `GET /readyz`，用于展示就绪状态；当前控制面可能返回 `ready=false`，首版不以 readyz 阻断管理入口。
6. 网关把端点和握手结果写入服务端会话，返回前端。

握手成功响应建议：

```json
{
  "connected": true,
  "endpoint": "http://10.0.0.12:9983",
  "health": {"status": "ok"},
  "ready": {"ready": false, "reason": "not implemented"},
  "version": {"version": "dev"}
}
```

握手失败响应建议：

```json
{
  "connected": false,
  "message": "control plane health check failed",
  "detail": "connect: connection refused"
}
```

## Web 网关接口

Web 网关提供面向前端的本地接口：

- `POST /api/session/connect`：接收控制面端点并执行握手。
- `GET /api/session`：返回当前会话端点、连接状态和最后一次探测结果。
- `DELETE /api/session`：断开当前控制面会话。
- `POST /api/session/probe`：重新探测当前控制面。
- `/api/control/*`：代理到当前会话绑定的控制面 REST API。

代理规则：

- [ ] 未连接时，所有 `/api/control/*` 返回 `409 not_connected`。
- [ ] 代理必须保留控制面响应体中的 `code`、`message`、`data`。
- [ ] 控制面网络错误统一转换为 Web 网关错误，不伪造业务成功。
- [ ] 对 `common.NotImplemented` 或 HTTP 501 语义，前端显示“后端未实现”。

## 前端功能分区

首版管理界面建议按资源分区：

- 系统：健康状态、就绪状态、版本信息、当前控制面端点。
- QubuiFS：列表、创建、详情、删除、拓扑节点注册/反注册。
- 节点：列表、添加、详情、删除、状态。
- 数据设备：节点设备列表、添加设备、删除设备。
- 元数据：导出控制面元数据。

需要和当前后端状态保持一致：

- [ ] 已实现或部分实现的接口可以开放表单和操作入口。
- [ ] 明确未实现的接口可以展示入口，但按钮需要标识“后端未实现”或在调用失败后给出准确提示。
- [ ] 页面不应假设 `readyz=true`，因为当前控制面 readiness 仍是占位语义。

## 会话与安全

首版不设计用户账号体系，“登录”语义等同于连接一个控制面端点。

安全要求：

- [ ] 控制面端点只保存在 Web 网关会话中，不写入可共享的静态配置文件。
- [ ] 默认使用 HttpOnly session cookie 标识浏览器会话。
- [ ] 网关需要限制代理目标为当前会话端点，不能让前端传入任意 URL 进行开放代理。
- [ ] 生产部署建议只允许内网控制面地址，并通过容器网络或 Kubernetes Service 访问。
- [ ] 如果后续控制面增加认证，凭据应由网关保存并注入代理请求，前端只持有会话 cookie。

## 容器化部署

容器职责：

- [ ] 启动 Web 网关。
- [ ] 提供静态前端资源。
- [ ] 暴露统一 HTTP 端口，例如 `8080`。
- [ ] 支持通过环境变量配置监听地址、日志级别和会话密钥。

建议环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `QUBUIFS_WEB_LISTEN` | `:8080` | Web 容器监听地址 |
| `QUBUIFS_WEB_SESSION_SECRET` | 无 | session 签名密钥，生产环境必填 |
| `QUBUIFS_WEB_CONNECT_TIMEOUT` | `3s` | 控制面握手超时 |
| `QUBUIFS_WEB_REQUEST_TIMEOUT` | `10s` | 管理 API 代理超时 |
| `QUBUIFS_WEB_ALLOWED_ENDPOINTS` | 空 | 可选端点 allowlist，空表示不限制 |

部署示例：

```bash
docker run --rm -p 8080:8080 \
  -e QUBUIFS_WEB_SESSION_SECRET=change-me \
  harbor.local/qubuifs/qubuifs-web:latest
```

## 错误处理

前端错误提示按来源区分：

- 端点格式错误：初始化页直接提示输入不合法。
- 网络不可达：提示控制面不可达，保留用户输入。
- 握手失败：提示 healthz 不通过或响应不符合预期。
- 控制面业务错误：显示控制面返回的 `message`。
- 后端未实现：显示“该管理语义后端尚未实现”。
- 会话失效：退回初始化页，并提示需要重新连接控制面。

## 后续里程碑

### M1. 文档与契约

- [x] 提交当前管理面 OpenAPI 文档。
- [x] 补充 Web 初始化、握手和容器化设计草案。
- [ ] 根据后端实现状态标注接口可用性矩阵。

### M2. Web 骨架

- [ ] 初始化前端工程。
- [ ] 实现 Web 网关和 `/api/session/*`。
- [ ] 实现容器构建文件。

### M3. 管理界面

- [ ] 实现初始化页和握手流程。
- [ ] 实现系统状态页。
- [ ] 实现 QubuiFS、节点、数据设备和元数据导出页面。

### M4. 部署验证

- [ ] 本地容器运行验证。
- [ ] 使用真实控制面端点完成握手验证。
- [ ] 验证未连接状态下管理 API 不可用。

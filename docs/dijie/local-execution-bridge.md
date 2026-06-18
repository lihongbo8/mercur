# 迭界AI本地执行桥

## Product Boundary

迭界AI云端使用 Mercur/Medusa 作为账号、岗位商场、订单、一次授权、审核和开发者中心的业务实现基础。OpenClaw fork 不是外接插件，也不是被削成纯 SaaS 后端；它改名和迁移业务规则后就是迭界AI主系统本体，保留原有对话、编程、workspace、session、Gateway、工具调用、文件读写、测试、memory 和 artifact 生成能力。

云端不直接操作本地文件，本地端不直接修改订单、钱包、授权或审核状态。两边通过短期执行授权和审计摘要连接。

产品边界固定为：

```text
云端 = SaaS 管理层，负责账号、岗位商城、岗位商品、订单授权、审核、结算、execution token 和安全审计摘要。
本地端 = 私有资料和真实执行层，负责 workspace、文件、素材、页面截图、本地工具调用、本地岗位实例运行库和本地岗位实例工作记忆。
岗位本身 = 无状态能力模板，不保存用户资料、运行库、工作记忆或长期状态。
```

## Adaptation Boundary

开发边界定死：OpenClaw 侧和 Mercur/Medusa 商城侧都必须在原有能力基础上改编，不允许硬性直接植入一套平行功能。只有原框架真的没有的能力，才考虑新增模块；新增模块前必须先和用户确认。

OpenClaw 侧原则：

```text
原有主对话框 -> 继续作为唯一自然语言入口；模式只是同一聊天框里的当前角色、工作身份和流程阶段
原有 session / workspace -> 继续承载上下文和本地执行
原有 Gateway -> 继续作为唯一执行和 RPC 入口
原有 tools / model / provider auth -> 继续作为运行能力
原有 logs / usage / status -> 优先接入迭界AI状态和审计信息
```

禁止为了迭界AI再造第二套聊天入口、第二套执行入口、第二套 workspace/runtime。OpenClaw 没有的业务能力才新增，例如 `AicsActorContext`、岗位商场授权、execution token、RolePackage/RoleResult 协议、审计桥、计费治理规则。

Mercur/Medusa 侧原则：

```text
原有 customer / seller / developer 账号 -> 改编为迭界AI买家和开发者身份
原有 product / listing / order -> 改编为岗位 listing 和一次授权订单
原有 admin / review 能力 -> 改编为岗位包审核和平台治理
原有 module / service 模式 -> 改编为 entitlement、audit、payout 记录
```

账号边界：岗位市场审核账号仅用于系统开发者/商城管理者审核上架，不属于购买本地系统的客户账号体系；本地端、使用者中心、开发者中心和岗位商城默认复用同一个迭界AI账号，不做额外账号链接。账号复用不代表数据全通，本地主系统只能由管理成员使用和配置，岗位员工、岗位使用者和开发者都必须按账号等级与 `dataScopes` 读取自己的岗位、包、授权、执行和收益数据。当前本地账号权限落在 `DijieAccountAccessProfile`，由 `GET /dijie/account/access` 回读、`PATCH /dijie/local/accounts/:accountId/access` 配置。审核入口必须显式具备 `marketplaceOwnerAccess` 或审核 scope，不能由本地主系统最高权限自动继承。

禁止绕过商城原有商业事实源另造影子商城、影子订单、影子账号。除非原框架没有合适设施，或者复用会破坏权限、审计、账本、生命周期边界，否则默认必须先改编原有能力。

## Development Operating Model

后续推进这个方向时，规划阶段和开发阶段都默认用三智能体模式。不是先由主智能体单独规划再分发，而是规划时就分成三路评审和拆分，开发时再三路执行。

三智能体规划：

```text
规划智能体 A：OpenClaw fork / 迭界AI主系统规划
-> 本地 App、Control UI、Gateway、device/session/workspace runtime
-> 本地执行、模型/运行身份、UI 失败状态风险

规划智能体 B：Mercur/Medusa fork / 迭界AI岗位商场规划
-> 账号、订单、entitlement、一次授权费、审计读写
-> 商业事实、auth、审核、listing 生命周期风险

规划智能体 C：集成 / 协议 / 安全规划
-> API contracts、ActorContext、token claims、RoleResult/AuditSummary
-> secret 泄露、跨系统事实归属、失败关闭语义
```

三智能体开发：

```text
子智能体 A：OpenClaw fork / 迭界AI主系统
-> 本地 App、Control UI、Gateway、device/session/workspace runtime
-> 本地执行、OpenClaw-native runEmbeddedAgent、RoleResult/AuditSummary
-> 页面失败状态、本地 validation/smoke 展示

子智能体 B：Mercur/Medusa fork / 迭界AI岗位商场
-> 账号、订单、entitlement、一次授权费
-> execution token 签发、audit 上传、audit read model
-> 开发者中心、审核、listing 生命周期

子智能体 C 或主智能体：controller / reviewer / integrator
-> 拆任务、保持边界、审核两边代码、跑关键测试
-> 检查没有假成功、没有 secret 泄露、没有跨系统直接写库
-> 最后用业务语言说明现在系统能做什么
```

主智能体不能在没有覆盖三路角色时声称已经三智能体规划或三智能体开发。如果系统子智能体数量限制导致无法同时派满三路，必须明确说明，并优先复用已有子智能体；主智能体必须显式承担缺失的集成/协议/安全角色，不能悄悄省略。

写入边界固定：

- OpenClaw 侧子智能体不修改 Mercur/Medusa 仓库。
- Mercur/Medusa 侧子智能体不修改 OpenClaw 仓库。
- 集成 / 协议 / 安全智能体只在确认归属后修改共享文档或协议 schema。
- 主智能体可以在审核后补 integration docs 或小范围 glue 修复，但必须说明修改文件和验证结果。

每次汇报按这个顺序：

```text
改完以后业务上能做什么
两个仓库分别改了什么
真实测试 / smoke 结果
还缺哪个真人页面闭环
```

## First Pricing Rule

第一版计费必须区分“计量、收费、收益归属”。所有对话、主系统模型用量、岗位执行模型用量和本地执行资源都进入统一计量；是否调用模型、费用记到哪个账号、收益归平台还是岗位开发者，是三个独立判断。

- 开发者为岗位 listing 设置授权价格。
- 开发者为岗位 listing 设置模型用量单价：`metadata.dijieRole.roleTokenPricing.inputTokenCentsPerMillion` 和 `outputTokenCentsPerMillion`，单位为分/百万 Token。
- 第一版岗位商品币种固定为 `CNY`，一次授权费必须是非负整数分值；岗位 Token 单价必须是整数分值，且不得低于平台 Token 成本价，也不得超过平台配置的最大倍率。
- 用户第一次购买/授权岗位时付款。
- 平台收入来自用户直接使用迭界AI主系统时产生的 token、模型、工具和执行用量计费；这些费用由系统平台按账号费用归属收费。
- 用户进入某个岗位执行上下文后，岗位模型用量按岗位 listing 的开发者定价收费；平台基准价、真实模型成本和开发者挂牌价必须分开记录。
- 岗位开发者收益来自开发者挂牌 Token 单价和平台基准 Token 单价之间的差额，授权费收益按 listing 定价规则进入开发者应收。
- 平台基准价、开发者定价合理性、费率阈值和价格风险先放进审核页/审核工作流，不新增独立费率管理页面。
- 用户后续运行该岗位不按运行时长额外计费；岗位运行的可计费资源先按模型 Token 账处理，后续若增加其他岗位用量类型也必须归岗位开发者。
- 运行时仍需要资源限制，例如单次最长运行时间、并发数、最大 artifact 大小和最大模型代理调用量。这些限制用于保护系统，不作为隐藏计费。

## Bridge Flow

```text
用户登录迭界AI云端
-> 购买/授权岗位
-> 迭界AI主系统本地 App 绑定同一账号和设备
-> 本地 Gateway 请求 execution token
-> 云端校验账号、entitlement、listing 状态、设备绑定和资源限制
-> 云端签发短期 execution token
-> 本地调度层创建或加载岗位实例
-> 本地调度层读取岗位实例运行库和工作记忆，组装运行上下文
-> 迭界AI主系统 runtime 在 workspace 中执行
-> 本地回写运行记录、质量问题、素材索引和记忆候选
-> 本地生成 RoleResult 和 AuditSummary 安全摘要
-> 云端记录审计摘要、artifact metadata、计费/结算派生和执行状态
```

真人验收步骤见 [迭界AI真人闭环验收 Runbook](./human-closed-loop-runbook.md)。该 runbook 用来记录真实账号、真实岗位商品、真实订单授权、本地执行、审计上传和安全审计读取的证据。

## Local Role Instance Storage Boundary

岗位商品和岗位包都不能自带数据库或记忆。用户授权岗位后，本地端才在当前 workspace 下创建“岗位实例”，并由本地调度层托管该实例的运行库和工作记忆。

本地岗位实例可以保存：

```text
日常状态
巡检记录
素材索引
质量问题
任务执行历史
工具调用摘要
产品保真标准
用户偏好
常见错误和修正方式
记忆候选
```

这些资料默认留在本地。云端只接收必要的安全摘要、审计投影、计费字段、能力画像、候选记忆摘要或用户明确确认后的同步内容。云端岗位商品、公开 listing、`metadata.dijieRole` 和开发者中心表单都不能保存本地原始素材、页面截图、完整运行历史、本地工作记忆、使用者模式私有记忆或记忆候选原文。

## Current OpenClaw UI Bridge

迭界AI主系统页面当前只作为桥接状态和审计调试面板，不作为第二套岗位生成对话框。用户自然语言入口必须继续使用 OpenClaw 原本主对话框；所谓使用者模式、开发者模式，只能表达同一聊天框下当前角色、工作身份和流程阶段，不能暗示为另一套聊天入口、另一套会话实体或另一套聊天产品。

岗位包生成的正式前端流程是对话优先：开发者在主对话里只补充业务逻辑、业务事实和通用岗位经验，直到主系统明确岗位要解决什么业务问题、给谁用、业务流程如何判断、希望完成什么结果。输入、输出、业务规则、验收标准、包结构、OpenClaw 工具协议边界、验证材料、定价意图和审核资料都由主系统内置资料包和开发者模式流程处理。主系统再把业务逻辑沉淀成内部 `RoleBuildBrief`，用隔离 workspace 生成 `role_package/`。这个 `role_package/` 是无状态能力模板，只保存人类岗位流程、公开业务逻辑、通用经验、判断标准、常见失败模式、验收样例和抽象能力需求；实施工具由本地 OpenClaw/迭界AI主系统通过 OpenClaw `tools.catalog`、`tools.effective`、`tools.invoke` 调用和审计，不能打进岗位包里。用户素材、运行库、工作记忆、使用者模式私有记忆和岗位实例状态也不能打进岗位包。

同一个主系统前端有两个用户模式：`使用者模式` 和 `开发者模式`。使用者模式用于购买/授权、启用和运行已有岗位；开发者模式由明确的模式切换、命令或开发者中心入口唤醒。进入开发者模式后，不是打开新的聊天产品，而是让原主对话进入岗位开发的当前工作身份和流程阶段：它只向开发者追问业务逻辑，平台内置资料包负责岗位包结构、协议、验收、验证和上传标准，并交付下载/上传到开发者中心的动作。

开发者模式必须切换上下文、权限、文案和可用动作。它可以读取本次开发者提供的需求、素材、公开协议和隔离 workspace；不能把使用者模式里的普通工作上下文、已购买岗位运行历史、主系统私有记忆或密钥当成岗位包生成输入。

开发者模式必须内置指南提示词和资料包，但这些都是本地主系统的私有过程材料。开发者只需要捋清业务逻辑；execution token、Gateway、RoleResult、AuditSummary、entitlement、审计上传、Token 计费、结算和开发者中心上传协议都由主系统资料包和云端桥处理，不能变成开发者必须学习或手填的接口知识。

开发者模式流程也不能把平台后端状态当成提示词材料。`executionId`、`actorId`、`entitlementId`、订单/钱包事实、结算快照、审核状态、cloud bearer 和 raw token 只能在平台桥、审计构建器、结算派生器和云端 API 内部流转。岗位开发流程只接收开发者提供的业务材料、公开岗位包协议/模板和隔离 workspace。

在开发者模式内部，开发者只表达业务逻辑。输入、输出、业务规则、异常处理、验收标准、测试样例、岗位包结构、OpenClaw 工具协议边界、验证材料和上传标准都是平台职责，已经内置在开发者模式流程和资料包里；不能要求内部开发者逐项填写、定义或确认这些标准。对于不用迭界AI开发者模式、选择用其他软件自行开发岗位包的外部开发者，这些维度可以作为公开平台标准和交付规范提供。

岗位包可以声明 `requiredCapabilities`，例如 `workspace.read`、`image.inspect`、`document.write`、`human.confirm`。这些是抽象本地能力需求，不是岗位自带工具清单，也不是新工具协议。包内不能包含浏览器工具、文件工具、命令工具、API client、MCP server、工具 schema、provider auth、secret 或本地工具实现；缺少 OpenClaw 工具协议 bridge 或 `tools.effective` 不支持时，OpenClaw 必须失败提示并记录审计，而不是伪装执行成功。

Skill、Tool、API、MCP、Provider 和 Adapter 归平台统一审核能力引用、风险边界、版本/hash、禁用和审计事实；实际实现由 OpenClaw 本地通用能力、用户配置的远程 API、MCP 或 provider 路由承接。岗位包只描述岗位本身：岗位名称、目标、服务对象、平台品类、输入输出、服务标准、服务节奏、验收和失败标准；不能保存 `requiredSkills`、`requiredTools`、特殊能力申请、skill/tool 实现、MCP server、adapter 源码、连接串、密钥或平台内部数据库访问能力。审核通过也不等于全岗位无条件调用：岗位必须绑定 approved 平台品类和基础品类包；超出基础品类包的能力必须走独立特殊能力包申请、审核、建设和绑定，运行时还必须通过用户授权、workspace 范围、风险策略和人工确认。

通用、高频、隐私敏感或低延迟能力可以作为本地 tool/skill 安装；岗位专属、低频、重型或商业 SaaS/生成/爬取类能力默认作为 `api`、`mcp` 或 `provider` 目录项，由本地 OpenClaw 做能力路由、授权配置和审计，不把实现下载到本地，也不把 provider key 或 OAuth token 写入云端。

`GET /dijie/gateway/roles/read-model` 给 OpenClaw 的每个 role 必须在顶层输出 `catalogRefs`。本地能力路由中心以这个数组作为主入口，例如 `tool:web.fetch@1.0`、`skill:market-research`、`api:image.generate@1.0.0`、`mcp:zapier.gmail.send`、`provider:openai.image.generate`、`capability:human.confirm`。`packageContext.catalogRefs` 和 `capabilityRequirements` 只作为详情和兼容投影；本地端不需要从岗位包里解析实现。

岗位品类体系已经进入平台治理链路：品类包是父包，内部绑定已审核的 Skill、Tool、API、MCP、provider 和 capability 引用。云端岗位只能保存 `categoryRef`、`categoryPackRef`、继承后的能力引用、安全摘要、版本/hash、风险等级和审核事实；不能把品类包实现、Skill 实现、工具源码、MCP server、adapter 源码或 provider key 写入岗位包或商品 metadata。

本地知识存储可以供应云端岗位绑定使用，但只能通过安全绑定投影：`knowledgeRef` / `catalogRef`、版本、hash、能力摘要、适用范围、风险摘要、来源类型和审核建议。它不能上传知识原文、素材、页面截图、本地绝对路径、用户私有记忆、完整运行历史、provider key、OAuth token、raw prompt 或 raw API request/response。云端审核通过的是这个知识/能力引用能否被岗位绑定，不是直接获得本地知识库读取权。

OpenClaw 本地端的第一版安全投影由能力路由中心纯函数生成：

```ts
type LocalKnowledgeSafeBindingExport = {
  schemaVersion: "aics.local_knowledge_binding_export.v1";
  categoryRef?: string;
  categoryPackRef?: string;
  projections: Array<{
    schemaVersion: "aics.local_knowledge_binding.v1";
    knowledgeRef: string;
    catalogRef: string;
    localCapabilityId: string;
    label: string;
    sourceType: "memory_core" | "memory_lancedb" | "memory_wiki" | "active_memory" | "unknown";
    version: string;
    hash: string;
    capabilitySummary: string[];
    riskSummary: string[];
    applicableScopes: string[];
    reviewRecommendation: string;
    routeStatus: "available";
  }>;
  omittedRoutes: Array<{
    catalogRef: string;
    status: string;
    reason: string;
  }>;
  forbiddenFields: string[];
};
```

只有本地真实可用的 knowledge / memory / wiki 能力会进入 `projections`。缺少真实工具、未安装、未启用、被策略阻断或需要配置的能力只能进入 `omittedRoutes`，不能伪装成云端可绑定能力。`hash` 是安全投影自身的稳定摘要，不是本地知识原文 hash，也不能被云端用来反推出知识内容。

平台业务数据库不是岗位可调用工具。岗位不能直接查平台订单、用户、钱包、审核、授权、结算等业务表，也不能执行任意数据库查询。确实需要数据能力时，只能通过独立且已审核的 adapter/tool，访问独立授权的数据源或安全投影，并记录调用岗位、用户、参数摘要、结果状态和失败原因。

第一版本地能力目录覆盖 `workspace`、`code`、`browser`、`document`、`spreadsheet`、`presentation`、`image`、`network`、`audit`、`human`。这个目录只是 `requiredCapabilities -> OpenClaw 工具协议` 的解释层；后续新增工具优先接入 OpenClaw 社区工具、插件或 MCP bundle，让工具进入 `tools.catalog` / `tools.effective` 后，再由本地 OpenClaw 的权限确认、风险策略、`tools.invoke` 和审计链路决定是否可执行。

## Cloud To Local Capability Routing Contract

云端给 OpenClaw 的岗位执行投影只表达能力需求和审核事实，不携带实现。当前稳定入口是 `GET /dijie/gateway/roles/read-model`，每个 role 至少应包含：

```ts
type DijieGatewayRoleCapabilityProjection = {
  id: string;
  title: string;
  packageId: string;
  packageVersion: string;
  categoryRef?: string;
  categoryName?: string;
  categoryPackRef?: string;
  skillPackRef?: string;
  toolPackRef?: string;
  inheritedCatalogRefs?: string[];
  inheritedCapabilityRefs?: string[];
  catalogRefs: string[];
  blockedCatalogRefs: string[];
  callable: boolean;
  unavailableReasons: string[];
  packageContext?: {
    category?: {
      categoryRef: string;
      name: string;
      categoryPackRef?: string;
      skillPackRef?: string;
      toolPackRef?: string;
    };
    inheritedCatalogRefs?: string[];
    inheritedCapabilityRefs?: string[];
    catalogRefs: string[];
    capabilityRequirements: Array<{
      ref: string;
      kind: "capability" | "tool" | "skill" | "api" | "mcp" | "provider";
      required: boolean;
      approved: boolean;
      risk?: "low" | "medium" | "high";
      permissionSummary?: string[];
      version?: string;
      hash?: string;
    }>;
    blockedCapabilities: string[];
  };
};
```

OpenClaw 能力路由中心以顶层 `catalogRefs` 为主入口，并结合本地 `tools.catalog`、Skill report、MCP/provider/plugin 配置解析为 `local_tool`、`local_skill`、`remote_api`、`remote_mcp`、`provider_capability`、`human_gate` 或 `unsupported`。`callable=false` 或 `blockedCatalogRefs` 非空时必须失败关闭，不能让 UI 或执行层伪装成已具备能力。

云端禁止返回 provider key、OAuth token、raw execution token、raw prompt、raw API request/response、本地绝对路径、工具源码、MCP server 实现、adapter 源码或平台业务数据库访问能力。本地端回传云端的执行事实也只能是 execution、capability usage、tool/model/API usage、cost、risk/audit summary 和脱敏失败原因。

开发者中心的表单只承接“已有岗位包”的上架资料：岗位包 ID、版本、清单入口、授权价、岗位 Token 单价、审核资料和发布状态。它不能反过来成为主系统里的岗位生成入口。

## Cloud Developer Center Boundary

Mercur/Medusa 云端仍是岗位商场、使用者中心和开发者中心的事实源，但第一版开发者中心不做完整云端 AI 助手，也不新增岗位生成聊天框。云端只管理账号、开发者身份、product/listing、订单授权、审核状态、执行授权、审计摘要和结算派生；不管理用户本地素材、岗位实例运行库或岗位实例工作记忆。

内部开发者在 OpenClaw/迭界AI主系统的开发者模式里只表达业务逻辑。输入、输出、业务规则、异常处理、验收标准、测试样例、岗位包结构、OpenClaw 工具协议边界、验证材料和上传标准由本地主系统内置资料包和开发者模式流程自动处理成内部 `RoleBuildBrief` 和 `role_package/`。开发者中心不能要求内部开发者把这些维度逐项手填成商品表单字段，也不能保存开发者模式的原始提示词、对话历史、`modeStage` 或私有 workspace 上下文。

开发者中心表单的上架边界固定为：

- 岗位包身份：`packageId`、`packageVersion` 和清单入口，例如 `role_package/manifest.json`。
- 商场展示资料：标题、副标题、描述、岗位能力摘要、本地能力需求摘要、图片、分类和销售渠道。
- 商业规则：一次授权费、岗位 Token 输入/输出单价、`CNY`、平台抽成为 0、开发者应收为 10000 bps。
- 审核生命周期：草稿、待审核、审核通过后发布、拒绝或下架。

对不用迭界AI开发者模式、选择用其他软件自行开发岗位包的外部开发者，输入、输出、业务规则、异常处理、验收标准和测试样例可以作为公开岗位包交付规范；这些规范应进入岗位包清单、包内文档或审核材料，而不是变成云端生成助手或 per-user 执行事实。

`metadata.dijieRole` 只能保存可公开 listing metadata 和审核/结算需要的稳定快照。它不能保存 `RoleBuildBrief`、开发者模式 prompt、聊天记录、`modeStage`、`executionId`、`actorId`、`entitlementId`、订单/钱包事实、`deviceId`、`workspaceRef`、`localGatewayId`、cloud bearer、raw execution token、provider auth、secret 原文、本地岗位实例运行库、本地岗位实例工作记忆、使用者模式私有记忆或记忆候选原文。这些字段只允许在本地主系统开发者模式流程、平台桥、execution token、审计构建器、结算派生器、本地调度层和云端 API 内部按需流转。

```text
填写 roleListingId / entitlementId / deviceId / workspaceRef / localGatewayId
-> 填入临时 cloud access token
-> 点击 获取执行授权
-> Gateway 调用 dijie.executionToken.request
-> 本地 extension 请求 POST /dijie/execution-token
-> 页面拿到短期 execution token
-> 填入或回填 executionId
-> 点击 查询审计记录
-> Gateway 调用 dijie.executionAudit.read
-> 本地 extension 请求 GET /dijie/executions/:executionId
```

`cloud access token` 只是开发期过渡输入，用来证明本地端可以通过云端账号授权拿到短期执行 token。它不能写入审计结果、role package、RoleResult、日志或本地持久配置。后续正式账号打通后，页面应由正常登录态换取 execution token，但仍然必须失败关闭：没有云端认证、没有 entitlement、listing 未发布、设备或 workspace 不匹配时，都不能进入本地执行。

正式产品流程禁止把 `cloud access token` 做成终端客户手填字段。它只是开发诊断输入；上线形态必须由统一账号/session 桥自动换取短期云端访问，并且只能作为请求凭证使用。它不能进入 `RoleResult`、`AuditSummary`、岗位包、本地配置、执行日志或可持久化 UI state。

## Billing Ledgers

第一版把平台收入和岗位开发者收入拆成账本语义，后续落数据库时必须保持拆分：

- `UsageLedger / main_system_usage`：用户直接使用迭界AI主系统产生的模型 token、工具执行、runtime 资源、下载和安装。收入归平台。
- `UsageLedger / dialog_usage`：商城、使用者中心、开发者中心、审核助手和本地主系统对话的统一计量。即使某个入口当前不调用模型，也要保留会话和管理辅助计量口径。
- `UsageLedger / role_usage`：用户使用某个岗位时产生的模型 Token 用量。它由审计摘要中的模型用量、真实模型成本、平台基准 Token 单价和 `roleTokenPricing` 开发者挂牌价共同派生。
- `MarketplaceOrderLedger`：岗位商场购买/授权事实，记录授权费、账号、岗位、订单和 entitlement 来源。
- `DeveloperPayoutLedger`：开发者应收。岗位授权费和岗位运行 Token 差价收益进入开发者应收。

当前 `apps/api/src/lib/dijie/ledgers.ts` 是纯业务规则层，还没有写入数据库。它先用于保护分账边界：主系统计费归平台；岗位购买/授权费归开发者；岗位运行中的 Token 收费按平台基准价和开发者挂牌价拆账；重复运行岗位不变成运行时长计费。

`DialogSession` / `DialogMessage` / `LedgerEntry` 是 AICS-293 本地版第一刀持久化事实层。`POST /dijie/dialog/messages` 返回 `sessionId` 和 `ledgerEntryId`，并为每次对话写入 `dialog_usage`。`GET /dijie/dialog/sessions`、`GET /dijie/dialog/sessions/:sessionId` 和 `GET /dijie/ledger/entries` 只返回安全投影；普通账号只能看自己的记录，本地主系统成员必须按 `dataScopes` 读取授权范围内的费用/计量记录。

## Current Role Marketplace Read Endpoints

`GET /dijie/roles` 是岗位商场公开岗位商品列表。它从 Medusa/Mercur 的真实 `product` facts 读取，只返回具备迭界AI岗位 metadata、审核通过、已上架、带岗位包身份、以及 `one_time_authorization` 定价的 product。普通商品、未审核 product、未上架 product、缺少一次授权费或缺少岗位包 identity 的 product 不会被投影成岗位。

当前岗位商品判定统一走 `apps/api/src/lib/dijie/role-product-metadata.ts`：

- `metadata.dijieRole.kind = "role_product"`
- `metadata.dijieRole.protocolVersion` 必填，默认目标版本为 `2026-05`
- `metadata.dijieRole.packageId` 必填
- `metadata.dijieRole.packageVersion` 必填
- `metadata.dijieRole.developerRef` 必填
- `metadata.dijieRole.listingOwnerRef` 必填，可从 seller 或 developerRef 派生
- `metadata.dijieRole.billingBeneficiaryRef` 必填，可从 developerRef 派生
- `metadata.dijieRole.listingStatus = "published"`
- `metadata.dijieRole.reviewState = "approved"`
- `metadata.dijieRole.pricing.kind = "one_time_authorization"`
- `metadata.dijieRole.pricing.currency = "CNY"`
- `metadata.dijieRole.pricing.platformFeeBps = 0`
- `metadata.dijieRole.pricing.developerReceivableBps = 10000`
- `metadata.dijieRole.pricing.developerReceivableCents = authorizationFeeCents`
- `metadata.dijieRole.roleTokenPricing.currency = "CNY"`
- `metadata.dijieRole.roleTokenPricing.inputTokenCentsPerMillion` 必须是整数，且不低于平台输入 Token 成本价
- `metadata.dijieRole.roleTokenPricing.outputTokenCentsPerMillion` 必须是整数，且不低于平台输出 Token 成本价
- `metadata.dijieRole.roleTokenPricing.platformFeeBps = 0`
- `metadata.dijieRole.roleTokenPricing.developerReceivableBps = 10000`
- `metadata.dijieRole.scopes` 只能包含 `role.execute` 和 `audit.write`

`manifestSummary.entrypoint` 不能是本地绝对路径，`metadata.dijieRole` 任意层级都不能保存本地绝对路径。metadata 不能包含 secret、token、provider auth、provider key、cloud bearer、raw execution token 字段名。`secretsRequired` 只能保存 secret 名称，不能保存 secret 原文。

`metadata.dijieRole` 也不能保存 prompt、开发者模式 prompt、`RoleBuildBrief`、`modeStage`、chat/conversation/message history、`executionId`、`actorId`、`entitlementId`、`deviceId`、`workspaceRef`、`localGatewayId`、订单事实或钱包事实。开发者中心和 admin review 只能读取这些严格 listing metadata；如果开发者提交了上述字段，即使商品被误改成 published，公开 listing、entitlement verifier 和执行入口也必须因 parser 校验失败而拒绝。

Admin 审核页必须在发布前校验一次授权费和 `roleTokenPricing`：授权费为非负整数、Token 单价不低于平台成本且不超过平台最大倍率、币种为 `CNY`、平台抽成为 0、开发者应收为 10000 bps。校验失败时只能停留在待审核状态，不能把 listing 发布。

`POST /dijie/entitlements/verify` 与 `GET /dijie/roles` 使用同一个严格 parser。也就是说，不能出现“公开岗位列表不显示，但 verifier 仍然把普通商品当成可执行岗位”的旁路。

`GET /dijie/my-roles` 是本地迭界AI主系统同步“我的岗位”的最小入口。它要求已认证账号，并优先读取本地 `RoleEntitlement` 与新 `RoleListing` 主数据；旧路径继续从真实 `order_group` / `order` / line item 与 product facts 兼容推导已授权岗位：

- 本地 `RoleEntitlement` 必须属于当前账号，且状态为 `authorized`。
- 旧订单兼容路径中，订单必须属于当前 customer。
- 旧订单兼容路径中，订单必须已付款，取消或未付款订单不产生岗位授权。
- 旧订单兼容路径中，line item 必须能匹配对应岗位 product。
- 响应返回 `entitlementId`、`orderId`、`authorizedAt` 和嵌套的 `role` 安全投影。

当前版本已新增本地 `RoleEntitlement` 第一刀，用于 0 元授权和本地执行授权校验；付费岗位仍必须走真实 checkout/订单事实，不能伪造已支付授权。OpenClaw 侧的 `dijie.marketplace.roles.list` 默认读取 `/dijie/my-roles`；云端不可达、未登录、响应结构不包含 roles 时，本地主系统必须失败提示，不能 fallback 成同步成功。

## Current Execution Token Endpoint

`POST /dijie/execution-token` 已接入失败关闭的短期执行授权签发路径。它要求已认证 customer、必填执行字段，并且必须配置：

- `DIJIE_EXECUTION_TOKEN_ISSUER_ENABLED=true`
- `DIJIE_ENTITLEMENT_VERIFY_URL`
- `DIJIE_ENTITLEMENT_VERIFY_BEARER`，当 verifier 使用内部接口时传递
- `DIJIE_EXECUTION_TOKEN_PRIVATE_KEY_PEM`，用于云端 Ed25519 私钥签名

云端会先调用 entitlement verifier 校验岗位授权、listing 状态、设备、本地 Gateway 和 workspace 关系。只有 verifier 返回 `ok: true`、岗位包身份、开发者/上架/结算归属，以及 `one_time_authorization` 价格时，才会签发 30 到 900 秒的 Ed25519 execution token。本地端后续只能用公钥验证 token，不能持有云端签名私钥。

这个接口不能 fallback 成成功，不能返回假 token，也不能接受 runtime-duration / metered pricing。设备绑定、listing 状态和资源限制的真实 verifier 仍是下一步需要接入的云端业务实现。

execution token 必须固化以下业务快照，后续审计、结算、争议处理都按 token 当时快照处理，不能按当前 product/listing 反查覆盖历史：

- `roleListingId`
- `packageId`
- `packageVersion`
- `developerRef`
- `listingOwnerRef`
- `billingBeneficiaryRef`
- `entitlementId`
- `pricing`
- `scopes`

## Current Entitlement Verifier

`POST /dijie/entitlements/verify` 是云端内部 verifier。它要求 `DIJIE_INTERNAL_BRIDGE_BEARER`，并优先用本地 `RoleEntitlement` 判断授权是否成立；旧订单路径继续用 Mercur/Medusa 的 marketplace facts 兼容判断一次授权是否成立：

- 本地 `RoleEntitlement` 必须属于 `actorId`，绑定请求里的 `roleListingId`，且状态为 `authorized`。
- 本地 `RoleListing` 必须是 `published` 且 `approved`，并给出 `packageId`、`packageVersion`、`developerRef`、`listingOwnerRef`、`billingBeneficiaryRef` 和一次授权定价。
- 旧订单路径中，`roleListingId` 对应的 product 必须存在。
- 旧订单路径中，product metadata 必须在 `metadata.dijieRole` 内显式声明可执行 listing 状态和审核状态：`listingStatus = "published"` 且 `reviewState = "approved"`。
- 旧订单路径中，product metadata 必须在 `metadata.dijieRole.pricing` 内显式声明 `one_time_authorization` 一次授权费；product-level 旧价格字段不能作为执行授权依据。
- 旧订单路径中，product metadata 必须能给出 `packageId`、`packageVersion`、`developerRef`、`listingOwnerRef`、`billingBeneficiaryRef`。
- 旧订单路径中，`entitlementId` 可映射为 `order_group.id` 或 `order.id`。
- 旧订单路径中，对应订单必须属于 `actorId` 这个 customer。
- 旧订单路径中，订单必须已付款，并且 line item 必须包含这个 `roleListingId`。

0 元岗位可以由 `POST /dijie/authorizations` 生成本地 `RoleEntitlement`；付费岗位必须由 checkout 完成事实生成授权，不能绕过订单和审核事实。

协议里的 `entitlementId` 表示“授权引用”，当前可引用本地 `RoleEntitlement.id`、旧 `order_group.id` 或旧 `order.id`。必须保留旧订单引用用于审计和兼容，不能重写历史执行记录。

## Current Cloud Dialog Model Bridge

云端对话模型桥是 Mercur/Medusa API 进程内的统一模型入口，不属于某一个页面。开发者中心、使用者/买家侧、审核中心和审核员工作台都必须通过同一个 resolver 调用 OpenClaw/OpenCloud 模型能力，再由各自的 surface、mode、权限和计费策略决定能不能调用模型。

当前共享入口：

- `POST /dijie/dialog/messages`
  - `surface=buyer_storefront`：买家岗位商城/使用者入口。
  - `surface=user_center`：使用者中心入口。
  - `surface=developer_center`：开发者中心 AI 对话；当消息是岗位包生成意图时会生成并保存 `role_package` 草稿。
  - `surface=admin_review`：平台审核助手/审核员工作台；只辅助总结、查缺失、评估风险和起草意见，不自动改变审核结果。
  - `surface=openclaw_local`：本地主系统桥接入口，仅允许具备本地主系统权限的账号。
- `POST /dijie/dialog/messages/stream`
  - 开发者中心普通对话优先使用的 SSE 入口；先返回 `status`，真流式可用时返回多个 `delta`，模型等待或流式失败时返回 `fallback`，最终返回与 `/dijie/dialog/messages` 同结构的 `final`。
- `POST /vendor/dijie/role-packages/generate`
  - 开发者中心岗位包生成的专用兼容入口，内部使用同一个 `resolveDijieOpenClawDialogModelBridge()`。

API 进程启动时配置一次模型桥即可覆盖这些入口：

```bash
# 推荐：通过迭界AI/OpenClaw 本地端桥接模型
DIJIE_OPENCLAW_MODEL_BRIDGE=cli
DIJIE_OPENCLAW_CLI_PATH=openclaw
DIJIE_OPENCLAW_MODEL_BRIDGE_EXECUTION=local
DIJIE_OPENCLAW_MODEL=<provider/model>
DIJIE_OPENCLAW_FAST_MODEL=<provider/fast-model>
DIJIE_OPENCLAW_MODEL_TIMEOUT_MS=1800000

# 可选：直接调用 Codex CLI
DIJIE_DIALOG_MODEL_BRIDGE=codex-cli
DIJIE_CODEX_CLI_PATH=codex
DIJIE_CODEX_MODEL=gpt-5.5
DIJIE_CODEX_FAST_MODEL=gpt-5.5
DIJIE_CODEX_SANDBOX=read-only
DIJIE_CODEX_TIMEOUT_MS=300000

# 可选：仅用于真 token delta 的 OpenAI Responses API 桥
DIJIE_OPENAI_STREAMING_ENABLED=true
DIJIE_OPENAI_API_KEY=<openai-api-key>
DIJIE_OPENAI_MODEL=<provider/model>
DIJIE_OPENAI_FAST_MODEL=<provider/fast-model>
```

也可以通过依赖注入注册 `DIJIE_OPENCLAW_MODEL_BRIDGE`，只要对象暴露 `completeDijieDialogMessage()` 方法。环境变量方式和依赖注入方式必须返回同一类安全响应：只回传 assistant reply 和脱敏后的 usage；不能把 provider key、raw model request/response、cloud bearer、execution token、本地绝对路径或 OpenClaw raw stdout/stderr 写入对话、草稿、审核记录或审计记录。

开发者中心普通对话会向模型桥传入 `latencyClass=fast_interaction`。OpenClaw CLI 桥在配置了 `DIJIE_OPENCLAW_FAST_MODEL` 时优先使用快模型；未配置时保持 `DIJIE_OPENCLAW_MODEL` 或 OpenClaw 本地默认模型原行为。Codex CLI 桥会运行 `codex exec --json --skip-git-repo-check --ephemeral --ignore-rules --sandbox <DIJIE_CODEX_SANDBOX>`，解析 `item.completed` 作为 assistant 回复，并解析 `turn.completed.usage` 作为 token usage；它是完整回复桥，不声明真 token delta。真 token 流式不走当前 OpenClaw CLI 或 Codex CLI 的完整 JSON/JSONL 输出路径，而是在 `DIJIE_OPENAI_STREAMING_ENABLED=true` 且配置 OpenAI API key 时使用 Responses API streaming；收到 `response.output_text.delta` 后转成 SSE `delta`。岗位包生成仍走强模型/默认模型路径和完整 JSON 校验。

岗位包生成不是一次性等待完整 JSON。`generateDijieRolePackageDraftWithModel()` 默认每次只推进一个 role_package 文件阶段，并在阶段完成后保存 `partial` 草稿；调用方只有显式传入 `maxStages` 时才会在同一请求内推进多个阶段。`partial` 草稿只能继续生成，不能进入上传承接；全部文件生成并通过上传校验、质量校验后才变为 `ready`。

模型桥未配置时：

- 普通对话可按 surface 返回本地规则 fallback，并标记 `modelCalled=false`。
- 开发者岗位包生成必须失败关闭，返回“模型桥暂未配置”，不能伪造岗位包草稿。
- 审核助手前端可展示本地审核规则 fallback，但不能声称已完成模型审核。

## Current Audit Upload Endpoint

`POST /dijie/audit` 是本地执行端上传 `AuditSummary` / `RoleResult` 的云端入口。它要求：

- `Authorization: Bearer <execution token>`
- `DIJIE_EXECUTION_TOKEN_PUBLIC_KEY_PEM`，用于验证云端签发的 Ed25519 execution token
- execution token 必须包含 `audit.write` scope
- 上传的 `executionId`、`roleListingId`、`entitlementId`、`deviceId`、`workspaceRef`、`localGatewayId` 必须和 execution token 完全一致
- `result.executionId`、`result.roleListingId`、`result.status` 必须和外层 audit summary 一致
- 必须注册真实 `dijieAuditRecordStore` Medusa module，或者兼容旧名 `dijieAuditSink` 且暴露 `recordDijieAuditSummary()` 方法的真实 store

当前 endpoint 只负责验签、验 scope、验字段一致性，然后调用 `apps/api/src/modules/dijie-audit` 的 `DijieAuditModuleService` 持久化审计记录。该 module 定义 `dijie_audit_record` 表，保存 `executionId`、actor、listing、entitlement、设备、workspace、本地 Gateway、状态、execution token issued/expires 时间、pricing snapshot、role token pricing snapshot、model/tool usage、changed files、artifact metadata、error summary 和完整 payload。

安全计费摘要只允许保存派生后的用量和金额：输入/输出 Token 数、对应的 `roleTokenPricing` 快照、`role_usage` 的平台应收 0、开发者应收金额、执行状态和必要争议字段。它不能保存模型原始请求/响应、provider key、用户本地主对话全文、raw stdout/stderr、raw execution token、cloud bearer 或本地绝对路径。

这里的完整 payload 仍必须是已脱敏 payload。禁止入库 cloud bearer、raw execution token、provider key、provider auth profile、模型原始请求/响应、主对话完整历史、raw stdout/stderr、本地绝对路径或 secret 原文。

授权和审计入库时必须固化 `packageId` / `packageVersion` / `developerRef` / `listingOwnerRef` / `billingBeneficiaryRef` / `pricingSnapshot`。开发者结算和争议处理必须依据当时的快照，不能只按当前 listing owner 反查。

没有审计 store 时返回 503，不会假装保存成功；store 写入失败时返回 502。这个 store 是第一版云端执行审计 read model 的落点。`GET /dijie/executions/:executionId` 只能返回安全投影，不能暴露执行 ID 以外的内部执行事实、本地私有路径、模型密钥或 provider auth。

## Current Execution Audit Read Endpoint

`GET /dijie/executions/:executionId` 是本地 OpenClaw Gateway 和开发者中心查看执行结果的最小 read endpoint。OpenClaw 侧通过正常云端 customer session/bearer（开发期称为 `cloud bearer`）查询该 endpoint；这个 bearer 只用于请求鉴权，不能写入审计记录、RoleResult、artifact metadata、本地日志或 role package。该 endpoint 要求已认证 customer actor，且只允许 `actorId` 与审计记录 `actor_id` 完全一致的调用者读取。它优先从 `dijieAuditRecordStore` module service 的 `retrieveDijieAuditRecordByExecutionId()` 读取；如果 module service 不在当前 scope 中暴露 read 方法，会尝试用 Medusa query graph 读取 `dijie_audit_record` read model。

成功响应只返回安全投影：

- `roleListingId`
- `packageId`
- `packageVersion`
- `developerRef`
- `listingOwnerRef`
- `billingBeneficiaryRef`
- `status`
- `pricing`
- `roleTokenPricing`
- `billingSummary`，只包含 `role_usage` 派生用量、单价、币种、平台应收 0 和开发者应收金额
- `toolUsage`
- `modelProxyUsage`
- `changedFiles`
- `artifacts`
- `errorSummary`
- `receivedAt`

该 endpoint 的响应不回显 `executionId`、`actorId`、`entitlementId`、`deviceId`、`workspaceRef`、`localGatewayId`、订单/钱包事实、完整 `payload`、execution token issued/expires 时间、raw token、cloud bearer、raw secrets、模型 provider key、provider auth 或本地绝对路径。`changedFiles` 如果收到本地绝对路径，只保留文件名或相对路径形态；artifact 字符串字段和 `errorSummary` 在返回前会再做出口脱敏，避免把用户机器路径或认证材料暴露给云端 UI / OpenClaw Gateway。

错误语义：

- 缺少已认证 actor 返回 401。
- 缺少 `executionId` path parameter 返回 400。
- 没有可用的 audit module/store/query read source 返回 503，失败关闭。
- 读取 store/query 失败返回 502。
- 找不到对应 execution audit record 返回 404。
- execution audit record 属于其他 actor 返回 403。

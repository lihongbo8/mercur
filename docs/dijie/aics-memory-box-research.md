# AICS Memory Box Research

日期：2026-06-07

## 结论

AICS 需要本地和云端两套记忆能力，但两者不能混成一套数据库。

- 本地 OpenClaw 记忆保存私有 workspace、素材索引、用户偏好、岗位实例执行经验和本地质量问题。
- 云端 Marketplace 记忆保存脱敏业务学习、岗位表现、审核结论、授权和执行统计、失败模式、推荐依据。
- 审核页、商城页、使用者页都需要云端记忆服务；OpenClaw 本地执行也要把脱敏摘要回写成云端候选记忆。
- 记忆盒子不进入 AICS-293 审核/商城/使用者闭环主链路，也不阻塞拟人 smoke。
- AICS-293 完成后，需要把记忆盒子作为独立 Mymir 后续任务排入开发图。

## 成熟系统参考

Graphiti / Zep 适合做云端业务学习图谱。它是开源 temporal knowledge graph，围绕 episode、entity、relationship、fact 建模，强调持续更新、provenance、bi-temporal validity、hybrid retrieval 和图数据库检索。AICS 后续可把已批准的云端记忆同步到 Graphiti，但不应让第一版商城主链路硬依赖 Graphiti。

Mem0 适合作为记忆生命周期 API 参考。它的 add、search、update、delete、delete_all、filter、user_id / agent_id / run_id / metadata 设计可以借鉴，尤其适合云端删除、过期、用户请求清理和低价值记忆归档。但 Mem0 不应直接替代 AICS 云端业务记忆模型。

Letta 适合作为 stateful agent memory 参考，不适合作为 AICS 第一版 runtime。它的 memory blocks、archival memory、stateful agent server 设计成熟，但会和 OpenClaw 主运行时重叠。

LangGraph 的短期/长期记忆分层值得借鉴。短期记忆用 thread state 和 checkpointer，长期记忆用 namespaced store；AICS 也应把执行中状态、账号私有记忆、商城公开/脱敏业务记忆拆开。

参考来源：

- Graphiti Docs: https://help.getzep.com/graphiti/graphiti/overview
- Graphiti GitHub: https://github.com/getzep/graphiti
- Mem0 Delete Memory: https://docs.mem0.ai/core-concepts/memory-operations/delete
- Mem0 GitHub: https://github.com/mem0ai/mem0
- Letta Stateful Agents: https://docs.letta.com/guides/core-concepts/stateful-agents/
- LangGraph Memory: https://docs.langchain.com/oss/javascript/concepts/memory

## OpenClaw 可复用能力

OpenClaw 本地记忆不是空白，第一版应优先迁引用现有能力。

- `memory-core` 提供 `memory_search`、`memory_get`、SQLite / sqlite-vec、keyword、hybrid search、temporal decay、MMR，以及 dreaming / promotion。
- `memory-lancedb` 提供 `memory_store`、`memory_recall`、`memory_forget` 和 LanceDB 长期向量记忆。
- `active-memory` 提供主动召回子 agent、timeout、cache、circuit breaker、transcript persistence。
- `memory-wiki` 提供 provenance-rich wiki vault、claim / evidence metadata、`wiki_search`、`wiki_get`、`wiki_apply`、`wiki_lint`。
- `dreaming` 提供 light / REM / deep 三阶段记忆进化；只有 deep phase 写入 durable `MEMORY.md`。
- `wiki-maintainer` skill 可作为 wiki 维护和 provenance 检查的直接参考。

本地侧第一版应复用这些插件和 CLI，而不是把 Graphiti、Mem0 或 Letta runtime 直接搬进 OpenClaw。

## 云端 Marketplace 记忆边界

云端 Marketplace v1 需要自己的 memory service / module，供审核、商城、使用者中心共同使用。

必须支持的 surface：

- `admin_review`：读取历史审核问题、岗位能力缺口、安全违规模式、定价风险和驳回/补充意见样例。
- `buyer_storefront`：读取公开或脱敏的岗位表现、适用场景、失败模式、对比依据和推荐依据。
- `user_center`：读取当前账号 entitlement、execution summary、billing summary、artifact refs 和个人可见使用经验。
- `openclaw_local`：上传脱敏执行摘要、artifact metadata、audit / ledger readback 和 memory candidate。

第一版云端数据库建议以 Medusa module 为主，不直接把 Graphiti 作为业务主库。

候选模型：

- `cloud_memory_candidate`：候选记忆，来源于审核、执行、反馈、人工确认。
- `cloud_memory_entry`：已批准记忆，可按 surface 和权限检索。
- `cloud_memory_evidence`：来源证据，关联 review、listing、execution、audit、artifact、ledger。
- `cloud_memory_policy`：可见范围和清理策略，如 public marketplace、account private、admin only、developer aggregate。

现有 `DijieMemoryCandidate` 和 `DijieEvolutionCandidate` 已经提供候选记忆和进化建议的起点；后续任务应优先扩展这个方向，而不是新建平行系统。

## 数据隔离和清理策略

本地 OpenClaw 私有记忆不得上传原文到云端。允许上传的云端材料必须是脱敏后的业务摘要、失败模式、岗位表现统计和 artifact metadata。

本地知识存储供应岗位绑定时，也只能输出安全绑定投影：知识/能力引用、版本、hash、适用范围、能力摘要、风险摘要、来源类型和审核建议。云端可以用这个投影做品类包或岗位特殊能力绑定审核，但不能获得本地知识库的直接读取权，也不能保存知识原文、素材、页面截图、本地路径、用户私有记忆、完整运行历史、provider key、OAuth token 或 raw API payload。

云端记忆必须支持：

- 用户删除请求。
- 敏感字段误入后的删除和审计。
- 过期会话和低价值候选清理。
- 被拒绝候选归档。
- surface 级权限隔离。
- 开发者只看聚合表现，不看客户本地素材和私有执行细节。

## 后续开发图动作

AICS-293 拟人 smoke 完成后，主动创建独立 Mymir 任务：

标题：Design AICS cloud/local memory service and marketplace memory surfaces

验收标准：

- 文档明确本地私有记忆、云端脱敏业务记忆、执行审计 readback 三者边界。
- 审核页、商城页、使用者中心都能通过云端记忆服务读取各自允许的记忆。
- 云端数据库表、权限边界、删除/过期/归档策略明确。
- 本地方案复用 OpenClaw memory/dreaming/wiki，不新造本地主记忆 runtime。
- Graphiti 作为后续 adapter，不阻塞 AICS-293 smoke。

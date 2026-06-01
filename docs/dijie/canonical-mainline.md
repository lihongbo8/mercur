# 迭界AI 云端主线规则

日期：2026-06-01

## 规则

`lihongbo8/mercur` 是迭界AI云端和岗位商城的正式主项目。

本地仓库 remote 约定：

- `origin` 指向 `https://github.com/lihongbo8/mercur.git`
- `upstream` 指向 `https://github.com/mercurjs/mercur.git`

以后所有迭界AI云端开发、Mymir 任务、验证记录、部署说明和交接摘要，默认以 `origin/main` 为准。原上游 `mercurjs/mercur` 只作为可选同步来源，不再作为完成任务的 merge gate。

## 开发流程

- 新功能从 `origin/main` 拉分支。
- 完成后合入 `origin/main`，再更新 Mymir 状态。
- 上游 PR 只是可选投稿，不阻塞迭界AI主线。
- 从 `upstream/main` 同步更新必须显式执行，并在同步后跑云端测试。

## 完成标准

对迭界AI云端任务，完成标准是：

- 代码已进入 `lihongbo8/mercur:main`
- 对应测试或验证已记录
- Mymir 已更新状态和执行记录

不得再把 `mercurjs/mercur` 的 review/merge 权限作为默认阻塞条件。

import type { DijieRolePackageUploadFile } from "./role-package-upload";

export type DijieRolePackageQualityReport = {
  ok: boolean;
  score: number;
  requiredChecks: Array<{
    key: string;
    label: string;
    passed: boolean;
  }>;
  blockingIssues: string[];
};

const QUALITY_CHECKS: Array<{
  key: string;
  label: string;
  patterns: RegExp[];
}> = [
  {
    key: "positioning",
    label: "岗位定位",
    patterns: [/岗位定位|岗位目标|角色定位|负责/u],
  },
  {
    key: "task_work",
    label: "任务型工作",
    patterns: [/任务型工作|主图巡检|详情页巡检|产品保真/u],
  },
  {
    key: "routine_work",
    label: "日常型工作",
    patterns: [/日常型工作|每日|每周|每月|SOP/u],
  },
  {
    key: "main_image_skill",
    label: "主图巡检 skill",
    patterns: [/主图巡检/u, /产品主体|背景|卖点|遮挡|变形/u],
  },
  {
    key: "detail_page_skill",
    label: "详情页巡检 skill",
    patterns: [/详情页巡检/u, /模块顺序|风格统一|文案|低清|重复/u],
  },
  {
    key: "fidelity_skill",
    label: "产品保真自检 skill",
    patterns: [/产品保真/u, /通过|存疑|不通过/u, /人工复核/u],
  },
  {
    key: "issue_record",
    label: "问题记录",
    patterns: [/问题记录|问题台账/u, /严重程度|修改建议|状态/u],
  },
  {
    key: "design_standard",
    label: "设计标准维护",
    patterns: [/设计标准/u, /规则|沉淀|维护/u],
  },
  {
    key: "templates",
    label: "输出模板",
    patterns: [/主图巡检记录/u, /详情页视觉优化清单/u],
  },
  {
    key: "validation",
    label: "验收样例",
    patterns: [/验收样例|smoke|validation|失败标准/u],
  },
];

function combinedText(files: DijieRolePackageUploadFile[]): string {
  return files.map((file) => `${file.path}\n${file.content ?? ""}`).join("\n\n");
}

export function evaluateDijieRolePackageQuality(
  files: DijieRolePackageUploadFile[],
): DijieRolePackageQualityReport {
  const text = combinedText(files);
  const requiredChecks = QUALITY_CHECKS.map((check) => ({
    key: check.key,
    label: check.label,
    passed: check.patterns.every((pattern) => pattern.test(text)),
  }));
  const passedCount = requiredChecks.filter((check) => check.passed).length;
  const blockingIssues = requiredChecks
    .filter((check) => !check.passed)
    .map((check) => `缺少${check.label}`);

  return {
    ok: blockingIssues.length === 0,
    score: Math.round((passedCount / requiredChecks.length) * 100),
    requiredChecks,
    blockingIssues,
  };
}

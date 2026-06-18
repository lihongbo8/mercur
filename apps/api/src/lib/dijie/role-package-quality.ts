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
    key: "role_name",
    label: "岗位名称",
    patterns: [/"name"\s*:|岗位名称|岗位名|角色名称|岗位：/u],
  },
  {
    key: "role_goal",
    label: "岗位目标",
    patterns: [/岗位目标|目标|解决|负责|交付|结果/u],
  },
  {
    key: "service_audience",
    label: "服务对象",
    patterns: [/服务对象|面向|适用商家|客户|用户|团队/u],
  },
  {
    key: "category_binding",
    label: "平台品类",
    patterns: [/categoryRef|category_ref|平台品类|品类绑定|品类/u],
  },
  {
    key: "inputs_outputs",
    label: "输入输出",
    patterns: [/输入|输入资料|来源资料/u, /输出|输出物|交付物|交付结果|报告/u],
  },
  {
    key: "service_standards",
    label: "服务标准",
    patterns: [/服务标准|质量标准|工作标准|复核标准|验收标准/u],
  },
  {
    key: "cadence",
    label: "服务节奏",
    patterns: [/服务节奏|节奏|触发条件|每日|每周|每月|频率|cadence/u],
  },
  {
    key: "validation",
    label: "验收标准",
    patterns: [/验收|验收样例|通过|存疑|不通过/u],
  },
  {
    key: "failure_standard",
    label: "失败标准",
    patterns: [/失败标准|失败|降级|不能执行|人工复核/u],
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

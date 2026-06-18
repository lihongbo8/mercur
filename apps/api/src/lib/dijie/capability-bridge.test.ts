import { describe, expect, it } from "bun:test";
import {
  createDijieCapabilityMatchReport,
  createDijieRoleCapabilityBinding,
  extractDijieCapabilityNeeds,
} from "./capability-bridge";

const visualRoleIdea = `
我要做一个智能门锁电商美工岗位。
它负责主图、详情页、海报、店铺视觉维护、日常巡检、产品图保真自检、问题记录和设计标准维护。
它需要浏览器、web_search、web_fetch、图片理解、图片生成、人工复核和审计记录。
它还要读取商品资料、标准产品图、主图、详情页图，并写入问题台账和设计标准。
`;

function visualRolePackageFiles() {
  return [
    {
      path: "role_package/manifest.json",
      content: JSON.stringify({
        manifestVersion: 1,
        rolePackageId: "pkg_smart_lock_visual_designer",
        version: "0.1.0",
        name: "智能门锁电商美工岗位",
        requiredCapabilities: [
          "browser.use",
          "image.inspect",
          "image.generate",
          "aics_product_db.query_products",
          "aics_product_db.get_product_detail",
          "aics_product_assets.get_reference_images",
          "aics_product_assets.get_main_images",
          "aics_product_assets.get_detail_images",
          "aics_product_fidelity.self_check",
          "aics_visual_issue.create_issue",
          "aics_design_standard.get_rules",
          "aics_design_standard.add_rule",
          "human.confirm",
          "audit.record",
        ],
      }),
    },
    {
      path: "role_package/standards.md",
      content: "# 主图巡检\n检查产品主体、背景、卖点和变形风险。",
    },
  ];
}

function resultStatus(report: ReturnType<typeof createDijieCapabilityMatchReport>, key: string) {
  return report.results.find((result) => result.key === key)?.status;
}

describe("Dijie capability bridge", () => {
  it("extracts skill and tool needs from a complex role idea and manifest", () => {
    const needs = extractDijieCapabilityNeeds({
      roleIdea: visualRoleIdea,
      files: visualRolePackageFiles(),
    });

    expect(needs.requiredSkills.map((need) => need.key)).toEqual(
      expect.arrayContaining([
        "visual.main_image.inspect",
        "visual.detail_page.inspect",
        "visual.product_fidelity.self_check",
        "visual.issue.record",
        "visual.design_standard.maintain",
      ]),
    );
    expect(needs.requiredCapabilities.map((need) => need.key)).toEqual(
      expect.arrayContaining([
        "browser",
        "image.inspect",
        "image.generate",
        "aics_product_fidelity.self_check",
        "aics_design_standard.get_rules",
      ]),
    );
  });

  it("creates a match report without treating adapter work as a fake pass", () => {
    const report = createDijieCapabilityMatchReport({
      roleIdea: visualRoleIdea,
      files: visualRolePackageFiles(),
    });

    expect(report.ok).toBe(true);
    expect(resultStatus(report, "visual.main_image.inspect")).toBe("generated_candidate");
    expect(resultStatus(report, "browser")).toBe("available");
    expect(resultStatus(report, "image.inspect")).toBe("candidate_found");
    expect(resultStatus(report, "aics_product_fidelity.self_check")).toBe("adapter_needed");
    expect(report.adapterNeeded.length).toBeGreaterThan(0);
    expect(report.missing).toHaveLength(0);
  });

  it("blocks unknown capabilities instead of silently downgrading", () => {
    const report = createDijieCapabilityMatchReport({
      manifest: {
        requiredCapabilities: ["quantum.robot.arm"],
      },
    });
    const binding = createDijieRoleCapabilityBinding({
      rolePackageId: "pkg_unknown",
      report,
    });

    expect(report.ok).toBe(false);
    expect(report.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "quantum.robot.arm",
          status: "missing",
        }),
      ]),
    );
    expect(binding.blockedReasons.length).toBeGreaterThan(0);
    expect(binding.bindings[0]).toMatchObject({
      capabilityKey: "quantum.robot.arm",
      validationStatus: "blocked",
    });
  });
});

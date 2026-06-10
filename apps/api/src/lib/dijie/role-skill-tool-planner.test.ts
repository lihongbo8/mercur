import { describe, expect, it } from "bun:test";
import {
  createDijieRoleCapabilityPlan,
  createDijieRoleRequirementSpec,
  renderDijieRoleToolRequirementsMarkdown,
} from "./role-skill-tool-planner";

describe("Dijie role skill/tool planner", () => {
  it("plans approved platform catalog bindings for a visual role", () => {
    const input = {
      message:
        "我要做一个智能门锁电商美工岗位，需要主图巡检、详情页巡检、产品保真、问题记录、每日每周每月管理和验收标准。",
      files: [
        {
          path: "role_package/manifest.json",
          content: JSON.stringify({
            manifestVersion: 1,
            rolePackageId: "visual_smart_lock_designer",
            version: "1.0.0",
            name: "智能门锁电商美工岗位",
            entrypoint: "role_package/README.md",
            permissions: ["role.execute", "audit.write"],
            requiredCapabilities: [
              "image.inspect",
              "image.generate",
              "browser",
              "human.confirm",
              "audit.record",
              "aics_product_db.query_products",
              "aics_product_assets.get_main_images",
              "aics_product_assets.get_detail_images",
              "aics_product_fidelity.self_check",
              "aics_visual_issue.create_issue",
              "aics_design_standard.get_rules",
              "aics_design_standard.add_rule",
            ],
            files: ["role_package/README.md"],
          }),
        },
      ],
    };

    const spec = createDijieRoleRequirementSpec(input);
    const plan = createDijieRoleCapabilityPlan(input);

    expect(spec.dailyTasks).not.toHaveLength(0);
    expect(spec.weeklyTasks).not.toHaveLength(0);
    expect(spec.monthlyTasks).not.toHaveLength(0);
    expect(plan.status).toBe("platform_ready");
    expect(plan.gaps).toEqual([]);
    expect(plan.catalogBindings.map((binding) => binding.catalogRef)).toEqual(
      expect.arrayContaining([
        "skill.platform.visual_main_image_inspection",
        "tool.platform.image_inspector",
        "adapter.platform.aics_product_query",
      ]),
    );
  });

  it("blocks direct platform database access as a role tool", () => {
    const plan = createDijieRoleCapabilityPlan({
      message: "这个岗位要直接查平台业务数据库和订单表。",
    });

    expect(plan.status).toBe("blocked");
    expect(plan.reviewBlockers.join("\n")).toContain("平台业务数据库不能作为岗位可调用工具");
  });

  it("renders a safe tool requirements file without implementations", () => {
    const input = {
      message: "做一个主图巡检岗位，需要图片理解、人工确认和验收标准。",
    };
    const requirementSpec = createDijieRoleRequirementSpec(input);
    const capabilityPlan = createDijieRoleCapabilityPlan(input);
    const rendered = renderDijieRoleToolRequirementsMarkdown({
      requirementSpec,
      capabilityPlan,
    });

    expect(rendered).toContain("catalog 引用");
    expect(rendered).toContain("平台业务数据库不是岗位工具");
    expect(rendered).not.toContain("api_key");
    expect(rendered).not.toContain("access_token");
    expect(rendered).not.toContain("MCP server 实现");
  });
});

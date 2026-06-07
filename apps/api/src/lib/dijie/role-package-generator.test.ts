import { describe, expect, it } from "bun:test";
import {
  extractDijieRolePackageJsonText,
  isDijieRolePackageGenerationIntent,
} from "./role-package-generator";

describe("Dijie role package generation intent", () => {
  it("detects explicit role package generation requests", () => {
    expect(
      isDijieRolePackageGenerationIntent(
        "我要做一个智能门锁电商美工岗位，请生成完整 role_package。",
      ),
    ).toBe(true);
  });

  it("does not treat negated generation wording as a heavy generation request", () => {
    expect(
      isDijieRolePackageGenerationIntent(
        "我想做智能门锁电商美工岗位。请用三条短句判断关键检查点，不要生成岗位包。",
      ),
    ).toBe(false);
    expect(
      isDijieRolePackageGenerationIntent(
        "不要生成文件，请把智能门锁电商美工岗位的开发工作拆成三步。",
      ),
    ).toBe(false);
  });
});

describe("Dijie role package model JSON extraction", () => {
  it("extracts a balanced JSON object from a model reply with surrounding prose", () => {
    const reply = [
      "下面是岗位包 JSON：",
      '{ "files": [{ "path": "role_package/manifest.json", "content": "{not a boundary}" }] }',
      "请查收。",
    ].join("\n");

    expect(JSON.parse(extractDijieRolePackageJsonText(reply))).toEqual({
      files: [
        {
          path: "role_package/manifest.json",
          content: "{not a boundary}",
        },
      ],
    });
  });

  it("extracts a model reply that escaped the whole JSON object", () => {
    const reply =
      '{\\"files\\":[{\\"path\\":\\"role_package/README.md\\",\\"content\\":\\"# README\\\\n```json\\\\n{\\\\\\"name\\\\\\":\\\\\\"智能门锁电商美工\\\\\\"}\\\\n```\\"}]}';

    expect(JSON.parse(extractDijieRolePackageJsonText(reply))).toEqual({
      files: [
        {
          path: "role_package/README.md",
          content: '# README\n```json\n{"name":"智能门锁电商美工"}\n```',
        },
      ],
    });
  });
});

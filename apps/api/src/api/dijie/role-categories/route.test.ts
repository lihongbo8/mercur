import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../lib/dijie/audit-store";
import { GET } from "./route";

type TestResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => TestResponse;
  json: (body: unknown) => unknown;
};

function response(): TestResponse {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return body;
    },
  };
}

function request() {
  return {
    scope: {
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE) {
          return {
            listDijieRoleCategoryRecords: async () => [
              {
                category_ref: "category:ecommerce_art_designer@1",
                name: "电商美工",
                version: "1",
                description: "电商视觉岗位品类。",
                category_status: "approved",
                reviewed_at: "2026-06-11T00:00:00.000Z",
                pack_binding: {
                  categoryPackRef: "categorypack:ecommerce_art_designer@1",
                  skillPackRef: "skillpack:ecommerce_art_designer@1",
                  toolPackRef: "toolpack:ecommerce_art_designer@1",
                  catalogRefs: ["skill:visual.main_image.inspect@1"],
                  capabilityRefs: ["image.inspect", "human.confirm"],
                  permissionSummary: ["image.inspect", "human.confirm"],
                },
              },
              {
                category_ref: "category:draft@1",
                name: "草稿品类",
                version: "1",
                description: "不应公开。",
                category_status: "draft",
              },
            ],
          };
        }
        throw new Error("unknown service");
      },
    },
  };
}

describe("GET /dijie/role-categories", () => {
  it("returns approved category references without implementation details", async () => {
    const res = response();
    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      categories: [
        {
          categoryRef: "category:ecommerce_art_designer@1",
          slug: "ecommerce_art_designer",
          name: "电商美工",
          packBinding: {
            categoryPackRef: "categorypack:ecommerce_art_designer@1",
            capabilityRefs: ["image.inspect", "human.confirm"],
          },
        },
      ],
    });
    expect(JSON.stringify(res.body)).not.toContain("草稿品类");
    expect(JSON.stringify(res.body)).not.toContain("provider key");
  });
});

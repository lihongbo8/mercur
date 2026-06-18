import { describe, expect, it } from "bun:test";
import { DIJIE_AUDIT_MODULE } from "../../../../../../lib/dijie/audit-store";
import { POST } from "./route";

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

function request(input: {
  actorId?: string | null;
  sellerId?: string | null;
  body?: Record<string, unknown>;
  service?: unknown;
}) {
  return {
    auth_context:
      input.actorId === null
        ? undefined
        : {
            actor_id: input.actorId ?? "acct_dev",
            actor_type: "member",
          },
    seller_context:
      input.sellerId === null
        ? undefined
        : {
            seller_id: input.sellerId ?? "sel_001",
          },
    params: {
      reviewId: "djcat_review_001",
    },
    body: {
      roleListingId: "djrole_123",
      ...(input.body ?? {}),
    },
    scope: {
      resolve(name: string) {
        if (name === DIJIE_AUDIT_MODULE && input.service) {
          return input.service;
        }
        throw new Error("service unavailable");
      },
    },
  };
}

describe("POST /vendor/dijie/special-capability-requests/:reviewId/bind", () => {
  it("requires a developer session and seller context", async () => {
    const res = response();

    await POST(request({ actorId: null, service: {} }) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("requires a role listing target", async () => {
    const res = response();

    await POST(
      request({
        body: { roleListingId: "" },
        service: {
          bindDijieSpecialCapabilityToRole: async () => {
            throw new Error("should not be called");
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      issues: ["roleListingId_required"],
    });
  });

  it("binds an approved special capability request to a role listing", async () => {
    const calls: unknown[] = [];
    const res = response();

    await POST(
      request({
        service: {
          bindDijieSpecialCapabilityToRole: async (input: unknown) => {
            calls.push(input);
            return {
              ok: true,
              binding: {
                bindingId: "djcapbind_001",
                bindingKey: "special-capability-binding",
                reviewRequestId: "djcat_review_001",
                catalogRef: "capability:visual.3d_render.inspect",
                need: "visual.3d_render.inspect",
                kind: "capability",
                rolePackageId: "djpkg_image_review",
                roleListingId: "djrole_123",
                categoryRef: "category:image_review@1",
                status: "bound",
                boundBy: "acct_dev",
                boundAt: "2026-06-12T00:00:00.000Z",
              },
            };
          },
        },
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(calls[0]).toEqual({
      reviewId: "djcat_review_001",
      roleListingId: "djrole_123",
      boundBy: "acct_dev",
      sellerId: "sel_001",
    });
    expect(res.body).toMatchObject({
      ok: true,
      binding: {
        bindingId: "djcapbind_001",
        status: "bound",
      },
    });
  });
});

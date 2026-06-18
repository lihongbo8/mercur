import { describe, expect, it } from "bun:test";
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

function request(body: unknown, actorId: string | null = "member_123") {
  return {
    body,
    auth_context: actorId
      ? {
          actor_id: actorId,
          actor_type: "member",
        }
      : undefined,
  };
}

describe("POST /vendor/dijie/capabilities/bind", () => {
  it("requires a developer actor", async () => {
    const res = response();

    await POST(request({ rolePackageId: "pkg_123" }, null) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("returns a binding draft from a resolved role idea", async () => {
    const res = response();

    await POST(
      request({
        rolePackageId: "pkg_smart_lock_visual_designer",
        roleListingId: "djrole_123",
        roleIdea: "智能门锁电商美工岗位，需要主图巡检、图片理解和问题记录。",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      binding: {
        rolePackageId: "pkg_smart_lock_visual_designer",
        roleListingId: "djrole_123",
        bindings: expect.arrayContaining([
          expect.objectContaining({
            capabilityKey: "visual.main_image.inspect",
            validationStatus: "needs_adapter",
          }),
          expect.objectContaining({
            capabilityKey: "image.inspect",
            validationStatus: "ready",
          }),
        ]),
      },
    });
  });
});


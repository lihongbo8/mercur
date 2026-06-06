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

describe("POST /vendor/dijie/capabilities/resolve", () => {
  it("requires a developer actor", async () => {
    const res = response();

    await POST(request({ roleIdea: "主图巡检" }, null) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("returns a capability match report", async () => {
    const res = response();

    await POST(
      request({
        roleIdea: "智能门锁电商美工岗位，需要主图巡检、图片理解、问题记录和人工复核。",
      }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      report: {
        results: expect.arrayContaining([
          expect.objectContaining({
            key: "visual.main_image.inspect",
            status: "generated_candidate",
          }),
          expect.objectContaining({
            key: "image.inspect",
            status: "candidate_found",
          }),
        ]),
      },
    });
  });
});


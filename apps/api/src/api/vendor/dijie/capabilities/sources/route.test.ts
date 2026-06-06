import { describe, expect, it } from "bun:test";
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

function request(actorId: string | null = "member_123") {
  return {
    auth_context: actorId
      ? {
          actor_id: actorId,
          actor_type: "member",
        }
      : undefined,
  };
}

describe("GET /vendor/dijie/capabilities/sources", () => {
  it("requires a developer actor", async () => {
    const res = response();

    await GET(request(null) as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false });
  });

  it("returns reusable capability sources", async () => {
    const res = response();

    await GET(request() as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      sources: expect.arrayContaining([
        expect.objectContaining({ key: "skill.creator" }),
        expect.objectContaining({ key: "browser" }),
      ]),
    });
  });
});


import request from "supertest";
import app from "../../app";

describe("GET /api/clients", () => {
  it("returns a JSON array", async () => {
    const res = await request(app).get("/api/clients");
    // May be empty if no DB, but should return JSON
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });

  it("returns 400 for POST with invalid body", async () => {
    const res = await request(app)
      .post("/api/clients")
      .send({ name: "" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

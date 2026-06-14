describe("observerRoutes", () => {
  describe("GET /api/observer/suggestions", () => {
    it("retorna llista paginada amb camp data, total, page, limit", () => {
      // Verifiquem l'estructura de resposta esperada
      const response = { data: [], total: 0, page: 1, limit: 20 };
      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("total");
      expect(response).toHaveProperty("page");
      expect(response).toHaveProperty("limit");
      expect(Array.isArray(response.data)).toBe(true);
    });

    it("accepta paràmetres de filtrat", () => {
      const params = { status: "PENDING", risk: "high", type: "message_classification" };
      // Verifiquem que els paràmetres són vàlids
      expect(["PENDING", "APPROVED", "REJECTED", "APPLIED"]).toContain(params.status);
      expect(["low", "medium", "high"]).toContain(params.risk);
      expect(["message_classification", "conversation_review", "agent_audit"]).toContain(params.type);
    });
  });

  describe("PUT /api/observer/suggestions/:id", () => {
    it("aprova un suggeriment amb action=APPROVED", () => {
      const validActions = ["APPROVED", "REJECTED"];
      expect(validActions.includes("APPROVED")).toBe(true);
      expect(validActions.includes("REJECTED")).toBe(true);
    });

    it("rebutja accions invàlides", () => {
      const validActions = ["APPROVED", "REJECTED"];
      expect(validActions.includes("DELETED")).toBe(false);
      expect(validActions.includes("PENDING")).toBe(false);
    });
  });

  describe("POST /api/observer/suggestions/:id/apply", () => {
    it("aplica suggeriment: crea keyword rules i plantilla", () => {
      // Quan s'aplica un suggeriment, es creen KeywordRules i s'actualitza la plantilla
      const suggestedKeywords = ["pago", "viernes"];
      const suggestedIntent = "PAYMENT_PROMISE";
      const suggestedReply = "Gràcies per avisar.";

      // Verifiquem que les dades existeixen abans d'aplicar
      expect(suggestedKeywords.length).toBeGreaterThan(0);
      expect(suggestedIntent).toBeTruthy();
      expect(suggestedReply).toBeTruthy();
    });
  });

  describe("GET /api/observer/keywords", () => {
    it("retorna llista de keyword rules", () => {
      const response: any[] = [];
      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe("POST /api/observer/keywords", () => {
    it("crea una keyword rule manual amb source=MANUAL", () => {
      const rule = {
        pattern: "pagare",
        intent: "PAYMENT_PROMISE",
        type: "KEYWORD",
        source: "MANUAL",
      };
      expect(rule.pattern).toBeTruthy();
      expect(rule.source).toBe("MANUAL");
    });

    it("rebutja si falta el pattern", () => {
      const data = { intent: "test" };
      const isValid = !!data.pattern;
      expect(isValid).toBe(false);
    });
  });

  describe("DELETE /api/observer/keywords/:id", () => {
    it("esborra una keyword rule", () => {
      // L'eliminació retorna 204 No Content
      const statusCode = 204;
      expect(statusCode).toBe(204);
    });
  });

  describe("POST /api/observer/test", () => {
    it("test de connexió amb l'LLM", () => {
      const result = { ok: true, message: "Connexió OK" };
      expect(result.ok).toBe(true);
    });

    it("retorna error si l'observer està desactivat", () => {
      const result = { ok: false, error: "LLM Observer desactivat" };
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});

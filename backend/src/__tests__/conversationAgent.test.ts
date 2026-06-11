// backend/src/__tests__/conversationAgent.test.ts
import { classifyMessage } from "../services/conversationAgent";

const mockKeywords = {
  pagament_clar: ["he pagat", "he pagado", "transferència feta", "transferencia hecha"],
  pagament_ambigu: ["fet", "hecho", "ok", "d'acord"],
  comprovant_enviat: ["comprovant", "comprobante", "adjunt"],
};

describe("classifyMessage", () => {
  describe("pagament_clar", () => {
    it("detecta confirmació en català", () => {
      const r = classifyMessage("Hola, ja he pagat la factura", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
      expect(r.action).toBe("confirmar_i_demanar_comprovant");
      expect(r.templateKey).toBe("template_pagament_clar");
    });

    it("detecta confirmació en castellà", () => {
      const r = classifyMessage("Ya he pagado, gracias", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
      expect(r.action).toBe("confirmar_i_demanar_comprovant");
    });

    it("detecta transferència feta en català", () => {
      const r = classifyMessage("Ja he pagat la transferència, saludos", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("detecta transferencia hecha en castellà", () => {
      const r = classifyMessage("Transferencia hecha ayer", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("extreu referència del missatge", () => {
      const r = classifyMessage("He pagat amb referència #12345", mockKeywords, false);
      expect(r.metadata.reference).toBe("12345");
    });

    it("extreu import del missatge", () => {
      const r = classifyMessage("He pagat 45,50€", mockKeywords, false);
      expect(r.metadata.amount).toBe("45.50");
    });
  });

  describe("pagament_ambigu", () => {
    it("detecta 'fet' com ambigu en català", () => {
      const r = classifyMessage("Fet!", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
      expect(r.action).toBe("demanar_detalls");
      expect(r.templateKey).toBe("template_pagament_ambigu");
    });

    it("detecta 'ok' com ambigu", () => {
      const r = classifyMessage("ok", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });

    it("detecta 'd'acord' com ambigu", () => {
      const r = classifyMessage("D'acord, gràcies", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });

    it("detecta 'hecho' com ambigu en castellà", () => {
      const r = classifyMessage("Ya está hecho", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });
  });

  describe("comprovant_enviat", () => {
    it("detecta comprovant per text", () => {
      const r = classifyMessage("T'envio el comprovant del pagament", mockKeywords, false);
      expect(r.intent).toBe("comprovant_enviat");
      expect(r.action).toBe("acusar_recepcio_comprovant");
      expect(r.templateKey).toBe("template_comprovant_rebut");
    });

    it("detecta adjunt en castellà", () => {
      const r = classifyMessage("Te adjunto el comprobante", mockKeywords, false);
      expect(r.intent).toBe("comprovant_enviat");
    });

    it("classifica com comprovant si té media encara que el text sigui buit", () => {
      const r = classifyMessage("", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });

    it("classifica com comprovant si té media encara que el text sigui 'ok'", () => {
      const r = classifyMessage("ok", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });
  });

  describe("altres_temes", () => {
    it("classifica text desconegut com altres_temes", () => {
      const r = classifyMessage("No entenc per què m'han cobrat això", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
      expect(r.action).toBe("redirigir");
      expect(r.templateKey).toBe("template_redireccio");
    });

    it("classifica preguntes com altres_temes", () => {
      const r = classifyMessage("Podeu trucar-me si us plau?", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });

    it("classifica missatge buit com altres_temes", () => {
      const r = classifyMessage("", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });

    it("classifica només emojis com altres_temes", () => {
      const r = classifyMessage("👍🙏", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });
  });

  describe("prioritat d'intencions", () => {
    it("pagament_clar té prioritat sobre comprovant (sense media)", () => {
      const r = classifyMessage("He pagat, t'envio el comprovant adjunt", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("media té prioritat sobre pagament_ambigu", () => {
      const r = classifyMessage("ok", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });
  });
});

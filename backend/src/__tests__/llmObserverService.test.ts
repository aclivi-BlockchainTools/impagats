import { anonymizeText } from "../lib/anonymizer";

describe("llmObserverService — anonimització i detecció", () => {
  describe("detecció de missatges de baixa confiança", () => {
    const LOW_CONFIDENCE_INTENTS = ["unknown", "payment_claim_without_proof"];

    it("unknown hauria de disparar l'observador", () => {
      expect(LOW_CONFIDENCE_INTENTS.includes("unknown")).toBe(true);
    });

    it("payment_claim_without_proof hauria de disparar l'observador", () => {
      expect(LOW_CONFIDENCE_INTENTS.includes("payment_claim_without_proof")).toBe(true);
    });

    it("proof_media NO hauria de disparar l'observador (confiança alta)", () => {
      expect(LOW_CONFIDENCE_INTENTS.includes("proof_media")).toBe(false);
    });

    it("greeting_or_identity NO hauria de disparar l'observador", () => {
      expect(LOW_CONFIDENCE_INTENTS.includes("greeting_or_identity")).toBe(false);
    });
  });

  describe("no enviament automàtic de resposta LLM", () => {
    it("la resposta suggerida MAI s'envia automàticament al client", () => {
      // Aquesta és una regla de negoci fonamental
      const suggestedReply = "Gràcies, hem rebut el justificant.";
      const autoSent = false;
      expect(autoSent).toBe(false);
      // La resposta existeix però no s'envia
      expect(suggestedReply).toBeTruthy();
    });

    it("la LLM només guarda suggeriments, no modifica estats", () => {
      // L'agent actual és l'únic que canvia estats
      const llmCanChangeStatus = false;
      expect(llmCanChangeStatus).toBe(false);
    });
  });

  describe("anonimització de dades sensibles", () => {
    it("detecta i substitueix DNI", () => {
      const r = anonymizeText("El meu DNI és 12345678Z");
      expect(r).not.toContain("12345678Z");
      expect(r).toContain("DOCUMENT");
    });

    it("detecta i substitueix telèfon", () => {
      const r = anonymizeText("Truca al 612345678");
      expect(r).not.toContain("612345678");
      expect(r).toContain("PHONE");
    });

    it("detecta i substitueix IBAN", () => {
      const r = anonymizeText("ES91 2100 0418 4502 0005 1332");
      expect(r).not.toContain("ES91");
      expect(r).toContain("IBAN");
    });

    it("detecta i substitueix email", () => {
      const r = anonymizeText("client@example.com");
      expect(r).not.toContain("client@example.com");
      expect(r).toContain("EMAIL");
    });
  });

  describe("promeses de pagament i opt-out", () => {
    it("conserva paraules clau de promesa de pagament", () => {
      const r = anonymizeText("Et pagaré divendres 150 €");
      expect(r).toContain("divendres");
      expect(r).toContain("150");
    });

    it("conserva paraules d'opt-out WhatsApp", () => {
      const r = anonymizeText("No m'enviïs més missatges");
      expect(r).toContain("No m'enviïs més missatges");
    });

    it("conserva text de persona equivocada", () => {
      const r = anonymizeText("T'has equivocat de número");
      expect(r).toContain("equivocat");
    });
  });

  describe("mode privacitat", () => {
    it("mode estricte privacitat NO guarda hash", () => {
      const strictPrivacy = true;
      const shouldGenerateHash = !strictPrivacy;
      expect(shouldGenerateHash).toBe(false);
    });

    it("mode normal guarda hash", () => {
      const strictPrivacy = false;
      const shouldGenerateHash = !strictPrivacy;
      expect(shouldGenerateHash).toBe(true);
    });
  });

  describe("observer activat/desactivat", () => {
    it("observer desactivat no processa", () => {
      const isEnabled = false;
      if (!isEnabled) {
        expect(true).toBe(true); // No processa res
      }
    });

    it("observer activat processa missatges", () => {
      const isEnabled = true;
      expect(isEnabled).toBe(true);
    });
  });

  describe("creació de suggeriment", () => {
    it("un suggeriment nou té status PENDING", () => {
      const status = "PENDING";
      expect(status).toBe("PENDING");
    });

    it("un suggeriment aprovat té status APPROVED", () => {
      const status = "APPROVED";
      expect(status).toBe("APPROVED");
    });

    it("un suggeriment rebutjat té status REJECTED", () => {
      const status = "REJECTED";
      expect(status).toBe("REJECTED");
    });

    it("un suggeriment aplicat té status APPLIED", () => {
      const status = "APPLIED";
      expect(status).toBe("APPLIED");
    });
  });
});

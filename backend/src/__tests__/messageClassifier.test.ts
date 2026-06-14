// Tests del classificador tancat de missatges

import { classify } from "../services/messageClassifier";

describe("messageClassifier", () => {
  describe("proof_media (primer justificant)", () => {
    it("detecta imatge guardada → proof_media", () => {
      const r = classify({ body: "T'envio el comprovant", hasMedia: true, mediaType: "image/jpeg", proofSaved: true });
      expect(r.intent).toBe("proof_media");
      expect(r.shouldMarkPendentRevisio).toBe(true);
    });

    it("detecta PDF guardat → proof_media", () => {
      const r = classify({ body: "Adjunto PDF", hasMedia: true, mediaType: "application/pdf", proofSaved: true });
      expect(r.intent).toBe("proof_media");
    });
  });

  describe("additional_proof_received (segon justificant)", () => {
    it("imatge guardada amb proof existent → additional_proof_received", () => {
      const r = classify({ body: "Un altre comprovant", hasMedia: true, mediaType: "image/jpeg", proofSaved: true, hasExistingProof: true });
      expect(r.intent).toBe("additional_proof_received");
      expect(r.shouldMarkPendentRevisio).toBe(true); // manté PENDENT_REVISIO
    });

    it("PDF guardat amb proof existent → additional_proof_received", () => {
      const r = classify({ body: "Adjunto més documents", hasMedia: true, mediaType: "application/pdf", proofSaved: true, hasExistingProof: true });
      expect(r.intent).toBe("additional_proof_received");
    });

    it("imatge guardada sense proof existent → proof_media (no additional)", () => {
      const r = classify({ body: "Comprovant", hasMedia: true, mediaType: "image/jpeg", proofSaved: true, hasExistingProof: false });
      expect(r.intent).toBe("proof_media");
    });
  });

  describe("pending_review_status (PENDENT_REVISIO + pregunta)", () => {
    it("'Tot correcte?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Tot correcte?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
      expect(r.shouldMarkRevisar).toBe(false);
      expect(r.shouldMarkPendentRevisio).toBe(false);
    });

    it("'Està pagat?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Està pagat?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'He de fer alguna cosa?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "He de fer alguna cosa?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Ya está?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Ya está?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Queda pagado?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Queda pagado?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Tot bé?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Tot bé?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Tengo que hacer algo más?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Tengo que hacer algo más?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Está todo bien?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Está todo bien?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Queda solucionado?' en PENDENT_REVISIO → pending_review_status", () => {
      const r = classify({ body: "Queda solucionado?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("'Està pagat?' en NOTIFICAT → question_about_debt (no pending_review_status)", () => {
      const r = classify({ body: "Està pagat?", hasMedia: false, proofSaved: false, currentStatus: "NOTIFICAT" });
      expect(r.intent).toBe("question_about_debt");
      // No ha de confirmar pagament
      expect(r.shouldMarkPagamentDeclarat).toBe(false);
    });

    it("NO canvia estat (ni PENDENT_REVISIO, ni REVISAR, ni PAGAMENT_DECLARAT)", () => {
      const r = classify({ body: "Tot correcte?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.shouldMarkPendentRevisio).toBe(false);
      expect(r.shouldMarkRevisar).toBe(false);
      expect(r.shouldMarkPagamentDeclarat).toBe(false);
      expect(r.shouldMarkEsperantJustificant).toBe(false);
    });
  });

  describe("greeting_or_identity", () => {
    it("'Hola, k ets?' → greeting_or_identity", () => {
      const r = classify({ body: "Hola, k ets?", hasMedia: false, proofSaved: false });
      expect(r.intent).toBe("greeting_or_identity");
    });
  });

  describe("payment_claim_without_proof", () => {
    it("'Pagat' → payment_claim_without_proof", () => {
      const r = classify({ body: "Pagat", hasMedia: false, proofSaved: false });
      expect(r.intent).toBe("payment_claim_without_proof");
      expect(r.shouldMarkPagamentDeclarat).toBe(true);
    });
  });

  describe("payment_promise", () => {
    it("'Demà ho pago' → payment_promise", () => {
      const r = classify({ body: "Demà ho pago", hasMedia: false, proofSaved: false });
      expect(r.intent).toBe("payment_promise");
      expect(r.shouldMarkEsperantJustificant).toBe(true);
    });
  });

  describe("complaint_or_problem", () => {
    it("'No puedo pagar' → complaint_or_problem", () => {
      const r = classify({ body: "No puedo pagar", hasMedia: false, proofSaved: false });
      expect(r.intent).toBe("complaint_or_problem");
      expect(r.shouldMarkRevisar).toBe(true);
    });
  });

  describe("prioritats", () => {
    it("pending_review_status té prioritat sobre question_about_debt", () => {
      const r = classify({ body: "Tot correcte?", hasMedia: false, proofSaved: false, currentStatus: "PENDENT_REVISIO" });
      expect(r.intent).toBe("pending_review_status");
    });

    it("additional_proof_received té prioritat sobre pending_review_status", () => {
      const r = classify({ body: "Tot correcte?", hasMedia: true, mediaType: "image/jpeg", proofSaved: true, currentStatus: "PENDENT_REVISIO", hasExistingProof: true });
      expect(r.intent).toBe("additional_proof_received");
    });
  });
});

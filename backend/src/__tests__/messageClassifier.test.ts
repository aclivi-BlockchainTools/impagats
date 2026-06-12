// Tests del nou classificador tancat de missatges

import { classify } from "../services/messageClassifier";

describe("messageClassifier", () => {
  describe("proof_media", () => {
    it("detecta imatge amb fitxer guardat", () => {
      const r = classify({
        body: "T'envio el comprovant",
        hasMedia: true,
        mediaType: "image/jpeg",
        proofSaved: true,
      });
      expect(r.intent).toBe("proof_media");
      expect(r.shouldMarkJustificantRebut).toBe(true);
      expect(r.shouldMarkPagamentDeclarat).toBe(false);
      expect(r.shouldReply).toBe(true);
    });

    it("detecta PDF amb fitxer guardat", () => {
      const r = classify({
        body: "Adjunto PDF",
        hasMedia: true,
        mediaType: "application/pdf",
        proofSaved: true,
      });
      expect(r.intent).toBe("proof_media");
      expect(r.shouldMarkJustificantRebut).toBe(true);
    });

    it("NO marca com proof_media si el fitxer no s'ha guardat", () => {
      const r = classify({
        body: "T'envio comprovant",
        hasMedia: true,
        mediaType: "image/jpeg",
        proofSaved: false,
      });
      expect(r.intent).not.toBe("proof_media");
      expect(r.shouldMarkJustificantRebut).toBe(false);
    });

    it("NO marca com proof_media si el media és àudio", () => {
      const r = classify({
        body: "",
        hasMedia: true,
        mediaType: "audio/ogg; codecs=opus",
        proofSaved: true,
      });
      expect(r.intent).toBe("audio");
    });
  });

  describe("payment_claim_without_proof", () => {
    it("'ja he pagat' → payment_claim_without_proof", () => {
      const r = classify({
        body: "Ja he pagat la factura",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
      expect(r.shouldMarkPagamentDeclarat).toBe(true);
      expect(r.shouldMarkJustificantRebut).toBe(false);
    });

    it("'ja està fet' → payment_claim_without_proof", () => {
      const r = classify({
        body: "Ja està fet, ho tens",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
    });

    it("'transferència feta' → payment_claim_without_proof", () => {
      const r = classify({
        body: "Transferència feta ahir",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
    });

    it("'ja he pagat' en castellà → payment_claim_without_proof", () => {
      const r = classify({
        body: "Ya he pagado la factura",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
    });

    it("'pago hecho' en castellà → payment_claim_without_proof", () => {
      const r = classify({
        body: "El pago ya está hecho",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
    });

    it("NO marca com proof si no hi ha media", () => {
      const r = classify({
        body: "Ja he pagat",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.shouldMarkJustificantRebut).toBe(false);
      expect(r.shouldMarkPagamentDeclarat).toBe(true);
    });
  });

  describe("question", () => {
    it("pregunta amb ? → question", () => {
      const r = classify({
        body: "De què és aquesta factura?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("question");
      expect(r.shouldReply).toBe(true);
      expect(r.shouldMarkRevisar).toBe(false);
    });

    it("'per què m'han cobrat això' → question", () => {
      const r = classify({
        body: "Per què m'han cobrat això?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("question");
    });

    it("'no entenc res' → question", () => {
      const r = classify({
        body: "No entenc res d'això",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("question");
    });

    it("'podeu explicar' → question", () => {
      const r = classify({
        body: "Em podeu explicar què és això?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("question");
    });
  });

  describe("complaint", () => {
    it("'no estic d'acord' → complaint", () => {
      const r = classify({
        body: "No estic d'acord amb aquest càrrec",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
      expect(r.shouldMarkRevisar).toBe(true);
    });

    it("'això és una estafa' → complaint", () => {
      const r = classify({
        body: "Això és una estafa!",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
    });

    it("'us denunciaré' → complaint", () => {
      const r = classify({
        body: "Us denunciaré a consum",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
    });

    it("'estic fart' → complaint", () => {
      const r = classify({
        body: "Ja n'estic fart, deixeu d'enviar missatges",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
    });

    it("comprovant + queixa → complaint (prioritat)", () => {
      const r = classify({
        body: "No estic d'acord, això és una estafa",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
    });
  });

  describe("wrong_person", () => {
    it("'no soc jo' → wrong_person", () => {
      const r = classify({
        body: "No soc jo, t'has equivocat de número",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("wrong_person");
      expect(r.shouldMarkRevisar).toBe(true);
    });

    it("'número equivocat' → wrong_person", () => {
      const r = classify({
        body: "Número equivocat",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("wrong_person");
    });

    it("'no conec aquesta empresa' → wrong_person", () => {
      const r = classify({
        body: "No conec aquesta empresa",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("wrong_person");
    });

    it("'error de persona' → wrong_person", () => {
      const r = classify({
        body: "Hi ha un error de persona",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("wrong_person");
    });
  });

  describe("audio", () => {
    it("detecta àudio OGG", () => {
      const r = classify({
        body: "",
        hasMedia: true,
        mediaType: "audio/ogg; codecs=opus",
        proofSaved: false,
      });
      expect(r.intent).toBe("audio");
      expect(r.shouldReply).toBe(true);
      expect(r.shouldMarkJustificantRebut).toBe(false);
    });

    it("detecta àudio genèric", () => {
      const r = classify({
        body: "escolta això",
        hasMedia: true,
        mediaType: "audio/mpeg",
        proofSaved: false,
      });
      expect(r.intent).toBe("audio");
    });
  });

  describe("unknown", () => {
    it("missatge buit → unknown", () => {
      const r = classify({
        body: "",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("unknown");
      expect(r.shouldReply).toBe(true);
    });

    it("només emojis → unknown", () => {
      const r = classify({
        body: "👍🙏",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("unknown");
    });

    it("'hola' → unknown", () => {
      const r = classify({
        body: "Hola",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("unknown");
    });

    it("missatge inesperat → unknown", () => {
      const r = classify({
        body: "adeu gracies",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("unknown");
    });
  });

  describe("prioritats", () => {
    it("media amb àudio té prioritat sobre text", () => {
      const r = classify({
        body: "Ja he pagat tot",
        hasMedia: true,
        mediaType: "audio/ogg",
        proofSaved: false,
      });
      expect(r.intent).toBe("audio");
    });

    it("wrong_person té prioritat sobre question", () => {
      const r = classify({
        body: "No soc jo, de què va això?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("wrong_person");
    });

    it("complaint té prioritat sobre question", () => {
      const r = classify({
        body: "No estic d'acord, podeu explicar-m'ho?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("complaint");
    });

    it("payment_claim té prioritat sobre question", () => {
      const r = classify({
        body: "Ja he pagat, de quina factura es tracta?",
        hasMedia: false,
        proofSaved: false,
      });
      expect(r.intent).toBe("payment_claim_without_proof");
    });
  });
});

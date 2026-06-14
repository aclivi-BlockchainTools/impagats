import { anonymizeText } from "../lib/anonymizer";

describe("anonymizeText", () => {
  describe("DNI/NIF/NIE", () => {
    it("substitueix DNI amb 8 dígits + lletra", () => {
      const r = anonymizeText("El meu DNI és 12345678Z");
      expect(r).not.toContain("12345678Z");
      expect(r).toContain("DOCUMENT");
    });

    it("substitueix NIF amb format 7 dígits + lletra", () => {
      const r = anonymizeText("NIF: 1234567Z");
      expect(r).not.toContain("1234567Z");
      expect(r).toContain("DOCUMENT");
    });

    it("substitueix CIF amb lletra + 7 dígits + lletra", () => {
      const r = anonymizeText("CIF B12345678");
      expect(r).not.toContain("B12345678");
      expect(r).toContain("DOCUMENT");
    });
  });

  describe("telèfon", () => {
    it("substitueix telèfon mòbil (6XXXXXXXX)", () => {
      const r = anonymizeText("Truca'm al 612345678");
      expect(r).not.toContain("612345678");
      expect(r).toContain("PHONE");
    });

    it("substitueix telèfon amb +34", () => {
      const r = anonymizeText("El meu número és +34 612 34 56 78");
      expect(r).not.toContain("612");
      expect(r).toContain("PHONE");
    });

    it("substitueix telèfon fix amb prefix", () => {
      const r = anonymizeText("Truqueu al 93 123 45 67");
      expect(r).not.toContain("93 123 45 67");
      expect(r).toContain("PHONE");
    });
  });

  describe("IBAN", () => {
    it("substitueix IBAN espanyol", () => {
      const r = anonymizeText("Compte: ES91 2100 0418 4502 0005 1332");
      expect(r).not.toContain("ES91");
      expect(r).toContain("IBAN");
    });

    it("substitueix IBAN sense espais", () => {
      const r = anonymizeText("ES9121000418450200051332");
      expect(r).not.toContain("ES91");
      expect(r).toContain("IBAN");
    });
  });

  describe("email", () => {
    it("substitueix email", () => {
      const r = anonymizeText("Escriu-me a client@example.com");
      expect(r).not.toContain("client@example.com");
      expect(r).toContain("EMAIL");
    });

    it("substitueix múltiples emails", () => {
      const r = anonymizeText("a@b.c i d@e.f");
      expect(r).not.toContain("@");
      expect(r.match(/EMAIL/g)?.length).toBe(2);
    });
  });

  describe("conservació", () => {
    it("conserva imports amb €", () => {
      const r = anonymizeText("He pagat 150.50 €");
      expect(r).toContain("150.50");
    });

    it("conserva mesos", () => {
      const r = anonymizeText("El rebut de maig 2026");
      expect(r).toContain("maig");
    });

    it("text sense dades personals queda igual", () => {
      const input = "Hola, gràcies per la informació";
      expect(anonymizeText(input)).toBe(input);
    });

    it("text buit retorna buit", () => {
      expect(anonymizeText("")).toBe("");
    });
  });
});

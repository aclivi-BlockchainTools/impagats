// Tests del parser SEPA XML amb fast-xml-parser

import { XMLParser } from "fast-xml-parser";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.03">
  <CstmrPmtStsRpt>
    <OrgnlPmtInfAndSts>
      <TxInfAndSts>
        <TxSts>RJCT</TxSts>
        <StsRsnInf>
          <Rsn>
            <Cd>AM04</Cd>
          </Rsn>
        </StsRsnInf>
        <OrgnlEndToEndId>E2E-REF-001</OrgnlEndToEndId>
        <OrgnlTxRef>
          <Amt>
            <InstdAmt>150.50</InstdAmt>
          </Amt>
          <ReqdColltnDt>2026-05-15</ReqdColltnDt>
          <Dbtr>
            <Nm>Maria Garcia</Nm>
          </Dbtr>
          <DbtrAcct>
            <IBAN>ES9121000418450200051332</IBAN>
          </DbtrAcct>
          <Cdtr>
            <Nm>Empresa Test</Nm>
          </Cdtr>
          <RmtInf>
            <Ustrd>TECNOLOGIA LLIURE S.C.P. Ntra. Factura n: 000757 de: 27/04/2026</Ustrd>
          </RmtInf>
          <MndtRltdInf>
            <MndtId>MD-001</MndtId>
          </MndtRltdInf>
        </OrgnlTxRef>
      </TxInfAndSts>
    </OrgnlPmtInfAndSts>
  </CstmrPmtStsRpt>
</Document>`;

const REJECTION_MEANINGS: Record<string, string> = {
  "AM04": "Fons insuficients",
  "AC01": "IBAN incorrecte",
  "MD01": "Mandat no trobat",
};

function rejectionLabel(code: string): string {
  const meaning = REJECTION_MEANINGS[code];
  return meaning ? `${code} - ${meaning}` : code;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  let m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1]), month = parseInt(m[2]), day = parseInt(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  m = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]);
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

function parseInvoiceNumber(ustrd: string): string | null {
  if (!ustrd) return null;
  const m = ustrd.match(/Factura\s*n[.:]*\s*(\d+)/i);
  return m ? m[1] : null;
}

function getNested(obj: any, ...keys: string[]): string | null {
  let current = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object") return null;
    const foundKey = Object.keys(current).find(
      (k) => k === key || k.endsWith(`:${key}`)
    );
    if (!foundKey) return null;
    current = current[foundKey];
  }
  if (typeof current === "string") return current.trim();
  if (typeof current === "number" || typeof current === "boolean") return String(current);
  if (typeof current === "object" && current["#text"]) return String(current["#text"]).trim();
  return null;
}

function parseTransaction(txInfo: any) {
  const txSts = getNested(txInfo, "TxSts");
  if (txSts !== "RJCT") return null;

  const amtStr = getNested(txInfo, "OrgnlTxRef", "Amt", "InstdAmt");
  const amount = amtStr ? parseFloat(amtStr) : 0;
  if (amount <= 0) return null;

  const collectionDateStr = getNested(txInfo, "OrgnlTxRef", "ReqdColltnDt") || "";
  const collectionDate = parseDate(collectionDateStr);

  const ustrd = getNested(txInfo, "OrgnlTxRef", "RmtInf", "Ustrd") || "";
  const debtorName = getNested(txInfo, "OrgnlTxRef", "Dbtr", "Nm") || "";
  const debtorIban = getNested(txInfo, "OrgnlTxRef", "DbtrAcct", "IBAN") || "";
  const rejectionCode = getNested(txInfo, "StsRsnInf", "Rsn", "Cd") || "UNKNOWN";
  const endToEndId = getNested(txInfo, "OrgnlEndToEndId") || "";
  const mandateId = getNested(txInfo, "OrgnlTxRef", "MndtRltdInf", "MndtId") || "";
  const invoiceNumber = parseInvoiceNumber(ustrd);
  const creditorName = getNested(txInfo, "OrgnlTxRef", "Cdtr", "Nm") || "";

  return {
    amount, collectionDate, debtorName: debtorName.trim(), debtorIban,
    invoiceNumber, rejectionCode, endToEndId, mandateId, creditorName: creditorName.trim(),
  };
}

describe("sepaXmlImporter - fast-xml-parser", () => {
  it("parseja XML SEPA vàlid", () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "#text",
      removeNSPrefix: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
    });

    const parsed = parser.parse(SAMPLE_XML);
    expect(parsed).toBeDefined();
    expect(parsed.Document).toBeDefined();
    expect(parsed.Document.CstmrPmtStsRpt).toBeDefined();
  });

  it("extreu transaccions del XML", () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "#text",
      removeNSPrefix: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
    });

    const parsed = parser.parse(SAMPLE_XML);
    const pmtInf = parsed.Document.CstmrPmtStsRpt.OrgnlPmtInfAndSts;
    expect(pmtInf).toBeDefined();

    const txInfos = Array.isArray(pmtInf.TxInfAndSts) ? pmtInf.TxInfAndSts : [pmtInf.TxInfAndSts];
    expect(txInfos.length).toBe(1);

    const tx = parseTransaction(txInfos[0]);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(150.50);
    expect(tx!.debtorName).toBe("Maria Garcia");
    expect(tx!.debtorIban).toBe("ES9121000418450200051332");
    expect(tx!.rejectionCode).toBe("AM04");
    expect(tx!.endToEndId).toBe("E2E-REF-001");
    expect(tx!.invoiceNumber).toBe("000757");
    expect(tx!.creditorName).toBe("Empresa Test");
  });

  it("extreu data de col·lecció", () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      textNodeName: "#text",
      removeNSPrefix: false,
      allowBooleanAttributes: true,
      parseAttributeValue: true,
    });

    const parsed = parser.parse(SAMPLE_XML);
    const txInfos = [parsed.Document.CstmrPmtStsRpt.OrgnlPmtInfAndSts.TxInfAndSts];
    const tx = parseTransaction(txInfos[0]);

    expect(tx!.collectionDate).toBeDefined();
    expect(tx!.collectionDate!.getFullYear()).toBe(2026);
    expect(tx!.collectionDate!.getMonth()).toBe(4); // May = 4 (0-indexed)
    expect(tx!.collectionDate!.getDate()).toBe(15);
  });

  it("codis de rebuig traduïts", () => {
    expect(rejectionLabel("AM04")).toBe("AM04 - Fons insuficients");
    expect(rejectionLabel("AC01")).toBe("AC01 - IBAN incorrecte");
    expect(rejectionLabel("MD01")).toBe("MD01 - Mandat no trobat");
    expect(rejectionLabel("ZZ99")).toBe("ZZ99"); // desconegut
  });

  it("parseja número de factura de Ustrd", () => {
    expect(parseInvoiceNumber("Ntra. Factura n: 000757 de: 27/04/2026")).toBe("000757");
    expect(parseInvoiceNumber("Ntra. Factura n.: 000670 de: 26/02/2026")).toBe("000670");
    expect(parseInvoiceNumber("Factura n. 1234")).toBe("1234");
    expect(parseInvoiceNumber("Sense factura")).toBeNull();
    expect(parseInvoiceNumber("")).toBeNull();
  });

  it("parseja data en format ISO", () => {
    const d = parseDate("2026-05-15");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(15);
  });

  it("parseja data en format DD/MM/YYYY", () => {
    const d = parseDate("15/05/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(15);
  });

  it("parseja data en format DD/MM/YY", () => {
    const d = parseDate("15/05/26");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
  });

  it("retorna null per data invàlida", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("invalid")).toBeNull();
    expect(parseDate("2026-13-01")).toBeNull(); // month 13
  });

  it("rebutja transaccions no RJCT", () => {
    const tx = parseTransaction({ TxSts: "ACCP" });
    expect(tx).toBeNull();
  });

  it("rebutja transaccions amb import 0", () => {
    const tx = parseTransaction({
      TxSts: "RJCT",
      OrgnlTxRef: {
        Amt: { InstdAmt: "0.00" },
        Dbtr: { Nm: "Test" },
      },
      StsRsnInf: { Rsn: { Cd: "AM04" } },
    });
    expect(tx).toBeNull();
  });
});

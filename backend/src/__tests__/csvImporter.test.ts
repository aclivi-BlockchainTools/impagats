import { jest } from "@jest/globals";

// Mock prisma before importing the service
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockUpdate = jest.fn();
const mockFindFirst = jest.fn();

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    bankMovement: {
      create: (...args: any[]) => mockCreate(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      findFirst: jest.fn().mockResolvedValue(null),
      update: (...args: any[]) => mockUpdate(...args),
      count: jest.fn().mockResolvedValue(0),
    },
    appSettings: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findMany: jest.fn().mockResolvedValue([]),
    },
    returnedReceipt: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    client: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    reconciliationMatch: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { importCsv } from "../services/csvImporter";

describe("csvImporter - parseAmount logic via import", () => {
  const mockFs = {
    readFileSync: jest.fn(),
  };
  jest.mock("fs", () => mockFs);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses Spanish decimal format (1.234,56 → 1234.56)", async () => {
    mockFs.readFileSync.mockReturnValue("Importe;Concepte;Data\n1.234,56;DEV REBUT TEST;01/01/26\n");
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    // Should parse the amount correctly
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.amount).toBeCloseTo(1234.56, 2);
  });

  it("parses English decimal format (1,234.56 → 1234.56)", async () => {
    mockFs.readFileSync.mockReturnValue("Amount;Description;Date\n1,234.56;TEST;01/01/26\n");
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.amount).toBeCloseTo(1234.56, 2);
  });

  it("parses comma as decimal (1234,56 → 1234.56)", async () => {
    mockFs.readFileSync.mockReturnValue("Import;Concepte;Data\n1234,56;DEV REBUT TEST;01/01/26\n");
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.amount).toBeCloseTo(1234.56, 2);
  });

  it("skips metadata rows and jumps to header", async () => {
    mockFs.readFileSync.mockReturnValue(
      "Banco de la Empresa\nExtracto bancario\nImporte;Concepte;Data\n100,00;TEST;01/06/26\n"
    );
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    // Should import 1 row (skipped 2 metadata lines)
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("parses date in DD/MM/YY format", async () => {
    mockFs.readFileSync.mockReturnValue("Importe;Concepte;Data\n100,00;TEST;31/12/25\n");
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    const date = call.data.date;
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(11); // December (0-indexed)
    expect(date.getDate()).toBe(31);
  });

  it("skips rows with empty concept", async () => {
    mockFs.readFileSync.mockReturnValue("Importe;Concepte;Data\n100,00;;01/01/26\n50,00;VALID;01/01/26\n");
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("moves / to header when first row is metadata", async () => {
    mockFs.readFileSync.mockReturnValue(
      "FECHA;SALDO;IMPORTE;CONCEPTO\n01/01/26;1000;100,50;TEST MOVEMENT\n"
    );
    mockCreate.mockResolvedValue({});

    const result = await importCsv("/fake/path.csv");

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    // Should use "importe" and "concepto" aliases
    expect(call.data.amount).toBeCloseTo(100.5, 2);
    expect(call.data.concept).toBe("TEST MOVEMENT");
  });
});

import { jest } from "@jest/globals";

// Mock prisma
const mockUpdate = jest.fn();
const mockFindFirst = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
let mockClients: any[] = [];
let mockInvoices: any[] = [];

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    returnedReceipt: {
      findUnique: (...args: any[]) => {
        const id = args[0]?.where?.id;
        // Will be set in each test
        return Promise.resolve(null);
      },
      findMany: (...args: any[]) => mockFindMany(...args),
      update: (...args: any[]) => mockUpdate(...args),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    client: {
      findMany: (...args: any[]) => Promise.resolve(mockClients),
      findFirst: jest.fn().mockResolvedValue(null),
      create: (...args: any[]) => {
        const data = args[0]?.data || args[0];
        mockClients.push({ id: mockClients.length + 1, ...data, active: true });
        return mockCreate(data);
      },
    },
    invoice: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findMany: (...args: any[]) => Promise.resolve(mockInvoices),
    },
    bankMovement: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    appSettings: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reconciliationMatch: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    matchCandidate: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
    message: { create: jest.fn() },
  },
}));

import { matchReceipt } from "../services/matchingEngine";

describe("matchingEngine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClients = [
      { id: 1, name: "Maria Garcia", whatsapp: "34600000001", active: true },
      { id: 2, name: "Joan Peris", whatsapp: "34600000002", active: true },
      { id: 3, name: "Empresa SL", active: true },
    ];
    mockInvoices = [];
    mockUpdate.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: 99 });
  });

  // We test extractClientName and nameMatchScore indirectly via matchReceipt

  it("matches by invoice number found in concept (client has WhatsApp → EMPARELLAT)", async () => {
    const receipt = {
      id: 1,
      status: "DETECTAT",
      receiptReference: "INV-2024-0056 payment",
      returnReason: "DEV REBUT",
      returnedAmount: 150.0,
      clientId: null,
      invoiceId: null,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    mockFindFirst.mockResolvedValueOnce({
      id: 5,
      invoiceNumber: "0056",
      clientId: 2,
      client: { id: 2, name: "Test", whatsapp: "34600000000", active: true },
    });

    await matchReceipt(1);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { invoiceId: 5, clientId: 2, status: "EMPARELLAT" },
    });
  });

  it("matches by invoice number but client lacks WhatsApp → REVISAR", async () => {
    const receipt = {
      id: 1,
      status: "DETECTAT",
      receiptReference: "INV-2024-0057 no-whatsapp",
      returnReason: "DEV REBUT",
      returnedAmount: 150.0,
      clientId: null,
      invoiceId: null,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    mockFindFirst.mockResolvedValueOnce({
      id: 6,
      invoiceNumber: "0057",
      clientId: 3,
      client: { id: 3, name: "NoWhats", whatsapp: null, active: true },
    });

    await matchReceipt(1);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { invoiceId: 6, clientId: 3, status: "REVISAR" },
    });
  });

  it("matches by client name from concept (client has WhatsApp → EMPARELLAT)", async () => {
    const receipt = {
      id: 1,
      status: "DETECTAT",
      receiptReference: "DEV.REBUT MARIA GARCIA",
      returnReason: "DEV.REBUT MARIA GARCIA",
      returnedAmount: 100.0,
      clientId: null,
      invoiceId: null,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    await matchReceipt(1);

    expect(mockUpdate).toHaveBeenCalled();
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.clientId).toBe(1); // Maria Garcia
    expect(call.data.status).toBe("EMPARELLAT");
  });

  it("creates new client with REVISAR status when no match found", async () => {
    const receipt = {
      id: 1,
      status: "DETECTAT",
      receiptReference: "DEV.REBUT NOU CLIENT DESCONEGUT",
      returnReason: "DEV.REBUT NOU CLIENT DESCONEGUT",
      returnedAmount: 200.0,
      clientId: null,
      invoiceId: null,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    await matchReceipt(1);

    expect(mockCreate).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    const call = mockUpdate.mock.calls[0][0];
    expect(call.data.status).toBe("REVISAR"); // Auto-created client → needs review
  });

  it("skips already matched receipts", async () => {
    const receipt = {
      id: 1,
      status: "EMPARELLAT",
      receiptReference: "ALREADY MATCHED",
      returnReason: "",
      returnedAmount: 100.0,
      clientId: 1,
      invoiceId: 3,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    await matchReceipt(1);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("skips IGNORED receipts", async () => {
    const receipt = {
      id: 1,
      status: "IGNORAT",
      receiptReference: "IGNORAT",
      returnReason: "",
      returnedAmount: 50.0,
      clientId: null,
      invoiceId: null,
    };

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    await matchReceipt(1);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("marks REVISAR when medium confidence match (0.4-0.89)", async () => {
    const receipt = {
      id: 1,
      status: "DETECTAT",
      receiptReference: "DEV.REBUT MARIA",
      returnReason: "DEV.REBUT MARIA",
      returnedAmount: 150.0,
      clientId: null,
      invoiceId: null,
    };

    // Only "Maria Garcia" exists, "MARIA" should get partial score (0.7)
    mockClients = [{ id: 1, name: "Maria Garcia", whatsapp: "34600000001", active: true }];

    jest.spyOn(
      jest.requireMock("../lib/prisma").default.returnedReceipt,
      "findUnique"
    ).mockResolvedValueOnce(receipt);

    await matchReceipt(1);

    const call = mockUpdate.mock.calls[0][0];
    // Score 0.7 < 0.9 threshold → REVISAR (not auto-matched)
    expect(call.data.status).toBe("REVISAR");
    expect(call.data.clientId).toBe(1);
  });
});

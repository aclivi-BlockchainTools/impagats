import { jest } from "@jest/globals";

// Mock prisma
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
let mockMovements: any[] = [];
let mockReceipts: any[] = [];

jest.mock("../lib/prisma", () => ({
  __esModule: true,
  default: {
    bankMovement: {
      findMany: (...args: any[]) => {
        // Filter by isReturn: false
        return Promise.resolve(mockMovements.filter((m: any) => !m.isReturn));
      },
      update: (...args: any[]) => {
        const { data } = args[0];
        const id = args[0].where.id;
        const idx = mockMovements.findIndex((m: any) => m.id === id);
        if (idx >= 0) mockMovements[idx] = { ...mockMovements[idx], ...data };
        return mockUpdate(...args);
      },
    },
    appSettings: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    returnedReceipt: {
      findFirst: (...args: any[]) => {
        const mvId = args[0]?.where?.bankMovementId;
        return Promise.resolve(mockReceipts.find((r: any) => r.bankMovementId === mvId) || null);
      },
      create: (...args: any[]) => {
        const data = args[0]?.data || args[0];
        mockReceipts.push({ id: mockReceipts.length + 1, ...data });
        return mockCreate(data);
      },
      findMany: jest.fn().mockResolvedValue([]),
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
    reconciliationMatch: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { detectReturns } from "../services/returnDetector";

describe("returnDetector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMovements = [];
    mockReceipts = [];
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
  });

  it("detects a return with keyword + negative amount", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "DEV.REBUT CLIENT TEST",
        amount: -150.0,
        date: new Date("2026-01-15"),
        reference: "REF001",
        isReturn: false,
        rawData: {},
      },
    ];

    const count = await detectReturns();

    expect(count).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isReturn: true },
    });
    expect(mockCreate).toHaveBeenCalled();
    const created = mockCreate.mock.calls[0][0];
    expect(created.returnedAmount).toBe(150.0);
    expect(created.status).toBe("DETECTAT");
  });

  it("ignores positive amounts even with keyword", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "DEV.REBUT CLIENT",
        amount: 150.0, // positive → not a return
        date: new Date("2026-01-15"),
        reference: "REF001",
        isReturn: false,
        rawData: {},
      },
    ];

    const count = await detectReturns();

    expect(count).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("ignores negative amounts without keyword", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "TRANSFERENCIA NORMAL",
        amount: -50.0, // negative but no return keyword
        date: new Date("2026-01-15"),
        reference: "REF001",
        isReturn: false,
        rawData: {},
      },
    ];

    const count = await detectReturns();

    expect(count).toBe(0);
  });

  it("does not duplicate existing returned receipt", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "DEV REBUT EXISTENT",
        amount: -200.0,
        date: new Date("2026-01-10"),
        reference: "REF002",
        isReturn: false,
        rawData: {},
      },
    ];
    mockReceipts = [
      { id: 1, bankMovementId: 1, returnedAmount: 200, status: "DETECTAT" },
    ];

    const count = await detectReturns();

    expect(count).toBe(0); // Already exists
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("detects return with 'devolució rebut' keyword", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "devolució rebut SEPA",
        amount: -75.50,
        date: new Date("2026-02-01"),
        reference: "REF003",
        isReturn: false,
        rawData: {},
      },
    ];

    const count = await detectReturns();

    expect(count).toBe(1);
  });

  it("extracts service period from Valor in rawData", async () => {
    mockMovements = [
      {
        id: 1,
        concept: "DEV.REBUT AMB VALOR",
        amount: -300.0,
        date: new Date("2026-03-15"),
        reference: "REF004",
        isReturn: false,
        rawData: { Valor: "15/03/26" },
      },
    ];

    await detectReturns();

    expect(mockCreate).toHaveBeenCalled();
    const created = mockCreate.mock.calls[0][0];
    expect(created.notes).toContain("Període:");
    expect(created.notes).toContain("Febrer");
    expect(created.notes).toContain("2026");
  });
});

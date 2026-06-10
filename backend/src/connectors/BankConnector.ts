export interface BankMovementRaw {
  concept?: string;
  amount: number;
  date: Date;
  reference?: string;
  iban?: string;
  rawData: Record<string, any>;
}

export interface BankConnector {
  fetchMovements(from: Date, to: Date): Promise<BankMovementRaw[]>;
}

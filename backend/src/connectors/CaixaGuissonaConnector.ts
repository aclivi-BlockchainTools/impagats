import { BankConnector, BankMovementRaw } from "./BankConnector";

export class CaixaGuissonaConnector implements BankConnector {
  // Placeholder — no s'implementa fins tenir documentació i credencials
  async fetchMovements(_from: Date, _to: Date): Promise<BankMovementRaw[]> {
    throw new Error("CaixaGuissonaConnector no implementat — pendent de documentació i credencials");
  }
}

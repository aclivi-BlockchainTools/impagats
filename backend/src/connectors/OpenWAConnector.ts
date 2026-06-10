import { config } from "../lib/config";

export class OpenWAConnector {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.openwaBaseUrl;
    this.apiKey = config.openwaApiKey;
  }

  async sendMessage(phone: string, text: string): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (!this.baseUrl) {
      return { success: false, error: "OPENWA_BASE_URL no configurat" };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify({ phone, message: text }),
      });

      if (!res.ok) {
        return { success: false, error: `OpenWA responded with ${res.status}` };
      }

      const data = await res.json() as any;
      return { success: true, externalId: data.id || data.messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const openwa = new OpenWAConnector();

import { config } from "../lib/config";
import prisma from "../lib/prisma";

export class OpenWAConnector {
  private async getConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const settings = await prisma.appSettings.findMany();
    const baseUrlKey = settings.find((s) => s.key === "openwa_base_url");
    const apiKeyKey = settings.find((s) => s.key === "openwa_api_key");

    return {
      baseUrl: baseUrlKey?.value || config.openwaBaseUrl,
      apiKey: apiKeyKey?.value || config.openwaApiKey,
    };
  }

  async sendMessage(phone: string, text: string): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const { baseUrl, apiKey } = await this.getConfig();

    if (!baseUrl) {
      return { success: false, error: "OPENWA_BASE_URL no configurat" };
    }

    try {
      const res = await fetch(`${baseUrl}/api/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
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

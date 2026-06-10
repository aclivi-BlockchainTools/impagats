import { config } from "../lib/config";
import prisma from "../lib/prisma";

export interface OpenWAConfig {
  baseUrl: string;
  apiKey: string;
  sessionId: string;
}

export class OpenWAConnector {
  async getConfig(): Promise<OpenWAConfig> {
    const settings = await prisma.appSettings.findMany();
    const baseUrlKey = settings.find((s) => s.key === "openwa_base_url");
    const apiKeyKey = settings.find((s) => s.key === "openwa_api_key");
    const sessionIdKey = settings.find((s) => s.key === "openwa_session_id");

    return {
      baseUrl: baseUrlKey?.value || config.openwaBaseUrl,
      apiKey: apiKeyKey?.value || config.openwaApiKey,
      sessionId: sessionIdKey?.value || "",
    };
  }

  async sendMessage(phone: string, text: string): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const { baseUrl, apiKey, sessionId } = await this.getConfig();

    if (!baseUrl) {
      return { success: false, error: "OPENWA_BASE_URL no configurat" };
    }

    try {
      const body: any = { phone, message: text };
      if (sessionId) body.sessionId = sessionId;

      const res = await fetch(`${baseUrl}/api/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(body),
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

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const { baseUrl, apiKey, sessionId } = await this.getConfig();

    if (!baseUrl) {
      return { ok: false, error: "URL del servidor no configurada" };
    }

    try {
      const url = sessionId
        ? `${baseUrl}/api/status?sessionId=${encodeURIComponent(sessionId)}`
        : `${baseUrl}/api/status`;

      const res = await fetch(url, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

export const openwa = new OpenWAConnector();

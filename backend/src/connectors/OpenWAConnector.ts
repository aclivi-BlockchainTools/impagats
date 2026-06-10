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
      return { success: false, error: "URL del servidor OpenWA no configurada" };
    }
    if (!sessionId) {
      return { success: false, error: "Session ID no configurat" };
    }

    try {
      // Format: phone@c.us for individual chats
      const chatId = phone.includes("@") ? phone : `${phone}@c.us`;

      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/messages/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ chatId, text }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { success: false, error: (errBody as any).message || `HTTP ${res.status}` };
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
    if (!apiKey) {
      return { ok: false, error: "API Key no configurada" };
    }

    try {
      // Check server health
      const healthRes = await fetch(`${baseUrl}/api/health`);
      if (!healthRes.ok) {
        return { ok: false, error: `Servidor no accessible (HTTP ${healthRes.status})` };
      }

      // Verify API key and session
      const sessionsRes = await fetch(`${baseUrl}/api/sessions`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!sessionsRes.ok) {
        return { ok: false, error: `API Key no vàlida (HTTP ${sessionsRes.status})` };
      }

      if (sessionId) {
        const sessions: any[] = await sessionsRes.json();
        const session = sessions.find((s: any) => s.id === sessionId);
        if (!session) {
          return { ok: false, error: `Session ID "${sessionId}" no trobada. Sessions disponibles: ${sessions.map((s: any) => s.name).join(", ")}` };
        }
        if (session.status !== "ready") {
          return { ok: false, error: `Sessió "${session.name}" no està ready (estat: ${session.status})` };
        }
      }

      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}

export const openwa = new OpenWAConnector();

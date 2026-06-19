import { config } from "../lib/config";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

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
      // Format: phone@c.us for individual chats (strip +, spaces, and all non-digits)
      const cleanPhone = phone.replace(/\D/g, "");
      const chatId = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@c.us`;

      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/messages/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ chatId, text }),
      });

      if (!res.ok) {
        const resText = await res.text().catch(() => "");
        let errDetail = "";
        try {
          const errJson = JSON.parse(resText);
          // OpenWA pot retornar error a .message, .error, .statusMessage o al cos complet
          errDetail = errJson.message || errJson.error || errJson.statusMessage || JSON.stringify(errJson);
        } catch {
          errDetail = resText || `HTTP ${res.status} ${res.statusText}`;
        }
        logger.warn({ chatId, status: res.status, statusText: res.statusText, body: resText?.substring(0, 500) }, "OpenWA sendMessage error");
        return { success: false, error: errDetail };
      }

      const data = await res.json() as any;
      return { success: true, externalId: data.id || data.messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async registerWebhook(appUrl: string): Promise<{ ok: boolean; webhook?: any; error?: string }> {
    const { baseUrl, apiKey, sessionId } = await this.getConfig();

    if (!baseUrl) return { ok: false, error: "URL del servidor no configurada" };
    if (!apiKey) return { ok: false, error: "API Key no configurada" };
    if (!sessionId) return { ok: false, error: "Session ID no configurat" };

    try {
      // First list existing webhooks
      const listRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/webhooks`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!listRes.ok) {
        return { ok: false, error: `Error llistant webhooks (HTTP ${listRes.status})` };
      }
      const existing: any[] = await listRes.json() as any[];

      const webhookUrl = `${appUrl}/api/openwa/webhook?secret=${config.webhookSecret}`;

      // Check if webhook already exists
      const existingWebhook = existing.find((w: any) => w.url === webhookUrl);
      if (existingWebhook) {
        return { ok: true, webhook: existingWebhook };
      }

      // Create the webhook
      const createRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ["message.received"],
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.json().catch(() => ({}));
        return { ok: false, error: (errBody as any).message || `Error creant webhook (HTTP ${createRes.status})` };
      }

      const webhook = await createRes.json();
      return { ok: true, webhook };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  async getWebhooks(): Promise<{ ok: boolean; webhooks?: any[]; error?: string }> {
    const { baseUrl, apiKey, sessionId } = await this.getConfig();

    if (!baseUrl) return { ok: false, error: "URL del servidor no configurada" };
    if (!apiKey) return { ok: false, error: "API Key no configurada" };
    if (!sessionId) return { ok: false, error: "Session ID no configurat" };

    try {
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/webhooks`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const webhooks = await res.json() as any[];
      return { ok: true, webhooks };
    } catch (err: any) {
      return { ok: false, error: err.message };
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
        const sessions: any[] = await sessionsRes.json() as any[];
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

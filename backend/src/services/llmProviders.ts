// Adaptadors LLM: OpenAI, Anthropic, DeepSeek
// Tots retornen el mateix format per ser intercanviables

export type LLMProviderType = "openai" | "anthropic" | "deepseek";

export interface LLMProviderConfig {
  provider: LLMProviderType;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface LLMProviderAdapter {
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

function createOpenAIAdapter(config: LLMProviderConfig): LLMProviderAdapter {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  return {
    async chat(messages) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${err}`);
      }
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || "";
    },
  };
}

function createAnthropicAdapter(config: LLMProviderConfig): LLMProviderAdapter {
  const baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
  return {
    async chat(messages) {
      // Convertir format OpenAI a Anthropic
      const systemMsg = messages.find((m) => m.role === "system");
      const userMsgs = messages.filter((m) => m.role !== "system");

      const body: any = {
        model: config.model,
        max_tokens: 1000,
        temperature: 0.1,
        messages: userMsgs.map((m) => ({ role: "user", content: m.content })),
      };
      if (systemMsg) {
        body.system = systemMsg.content;
        // Afegir instrucció JSON al system
        body.system += "\n\nYou MUST respond with valid JSON only. No other text.";
      }

      const res = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Anthropic error ${res.status}: ${err}`);
      }
      const data = await res.json() as any;
      return data.content?.[0]?.text || "";
    },
  };
}

function createDeepSeekAdapter(config: LLMProviderConfig): LLMProviderAdapter {
  const baseUrl = config.baseUrl || "https://api.deepseek.com/v1";
  return {
    async chat(messages) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`DeepSeek error ${res.status}: ${err}`);
      }
      const data = await res.json() as any;
      return data.choices?.[0]?.message?.content || "";
    },
  };
}

export function createLLMProvider(config: LLMProviderConfig): LLMProviderAdapter {
  switch (config.provider) {
    case "openai":
      return createOpenAIAdapter(config);
    case "anthropic":
      return createAnthropicAdapter(config);
    case "deepseek":
      return createDeepSeekAdapter(config);
    default:
      throw new Error(`Provider desconegut: ${config.provider}`);
  }
}

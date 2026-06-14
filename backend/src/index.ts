import app from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import prisma from "./lib/prisma";
import { llmObserver } from "./services/llmObserverService";

const server = app.listen(config.port, () => {
  logger.info(`Backend listening on port ${config.port}`);
});

llmObserver.loadConfig().catch((err) => {
  logger.error({ err }, "Error carregant LLM Observer config");
});

async function shutdown(signal: string) {
  logger.info(`${signal} rebut — tancant servidor i BD...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

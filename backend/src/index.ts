import app from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";

app.listen(config.port, () => {
  logger.info(`Backend listening on port ${config.port}`);
});

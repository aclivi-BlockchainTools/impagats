import app from "./app";
import { config } from "./lib/config";

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});

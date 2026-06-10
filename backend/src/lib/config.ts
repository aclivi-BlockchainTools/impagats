import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  openwaBaseUrl: process.env.OPENWA_BASE_URL || "",
  openwaApiKey: process.env.OPENWA_API_KEY || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "impagats-webhook-secret",
};

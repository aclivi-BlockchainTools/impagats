import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import clientsRouter from "./routes/clients";
import invoicesRouter from "./routes/invoices";
import bankMovementsRouter from "./routes/bankMovements";
import returnedReceiptsRouter from "./routes/returnedReceipts";
import messagesRouter from "./routes/messages";
import webhookRouter from "./routes/webhook";
import settingsRouter from "./routes/settings";
import dashboardRouter from "./routes/dashboard";
import healthRouter from "./routes/health";

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CORS_ORIGIN || "http://localhost:8080"
    : "http://localhost:5174",
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/clients", clientsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/bank-movements", bankMovementsRouter);
app.use("/api/returned-receipts", returnedReceiptsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/openwa/webhook", webhookRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/health", healthRouter);
app.use(errorHandler);

export default app;

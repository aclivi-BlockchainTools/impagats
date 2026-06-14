import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";
import clientsRouter from "./routes/clients";
import invoicesRouter from "./routes/invoices";
import bankMovementsRouter from "./routes/bankMovements";
import returnedReceiptsRouter from "./routes/returnedReceipts";
import messagesRouter from "./routes/messages";
import webhookRouter from "./routes/webhook";
import settingsRouter from "./routes/settings";
import dashboardRouter from "./routes/dashboard";
import healthRouter from "./routes/health";
import outboxRouter from "./routes/outbox";
import authRouter from "./routes/auth";
import caseNotesRouter from "./routes/caseNotes";
import proofsRouter from "./routes/proofs";

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CORS_ORIGIN || "http://localhost:8080"
    : (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
        // En dev, permetre localhost i xarxa local
        if (!origin) { callback(null, true); return; }
        if (origin.startsWith("http://localhost")) { callback(null, true); return; }
        if (origin.startsWith("http://192.168.")) { callback(null, true); return; }
        if (origin.startsWith("http://10.")) { callback(null, true); return; }
        if (origin.startsWith("http://172.")) { callback(null, true); return; }
        const allowed = process.env.CORS_ORIGIN;
        if (allowed && origin === allowed) { callback(null, true); return; }
        callback(null, false);
      },
}));
app.use(express.json({ limit: "1mb" }));

// Públiques (sense auth)
app.use("/api/health", healthRouter);
app.use("/api/openwa/webhook", webhookRouter);
app.use("/api/auth", authRouter);

// Protegides (requereixen auth)
app.use("/api/clients", authMiddleware, clientsRouter);
app.use("/api/invoices", authMiddleware, invoicesRouter);
app.use("/api/bank-movements", authMiddleware, bankMovementsRouter);
app.use("/api/returned-receipts", authMiddleware, returnedReceiptsRouter);
app.use("/api/messages", authMiddleware, messagesRouter);
app.use("/api/settings", authMiddleware, settingsRouter);
app.use("/api/dashboard", authMiddleware, dashboardRouter);
app.use("/api/outbox", authMiddleware, outboxRouter);
app.use("/api/case-notes", authMiddleware, caseNotesRouter);
app.use("/api/proofs", authMiddleware, proofsRouter);
app.use(errorHandler);

export default app;

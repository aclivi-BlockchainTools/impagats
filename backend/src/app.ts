import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import clientsRouter from "./routes/clients";
import invoicesRouter from "./routes/invoices";
import bankMovementsRouter from "./routes/bankMovements";
import returnedReceiptsRouter from "./routes/returnedReceipts";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/clients", clientsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/bank-movements", bankMovementsRouter);
app.use("/api/returned-receipts", returnedReceiptsRouter);
app.use(errorHandler);

export default app;

import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import clientsRouter from "./routes/clients";
import invoicesRouter from "./routes/invoices";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/clients", clientsRouter);
app.use("/api/invoices", invoicesRouter);
app.use(errorHandler);

export default app;

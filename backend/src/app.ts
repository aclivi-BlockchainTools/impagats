import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import clientsRouter from "./routes/clients";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/clients", clientsRouter);
app.use(errorHandler);

export default app;

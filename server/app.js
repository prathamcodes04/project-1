import express from "express";
import { config } from "dotenv"; //loads .env
import cors from "cors"; //allow frontend request
import cookieParser from "cookie-parser"; //read cookie
import fileUpload from "express-fileupload"; //handles uploaded files
import { createTables } from "./utils/createTables.js";
import { errorMiddleware } from "./middlewares/errorMiddlewares.js";
import authRouter from "./router/authRoutes.js"
import productRouter from "./router/productRoutes.js"

//load env variables
config({ path: "./config/config.env" });

const app = express();

//configure cors
app.use(
  cors({
    //only these websites are allowed to access backend
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); //parse html forms

//file upload
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "./uploads",
    limits: {
        fileSize: 5 * 1024 * 1024 //5 mb
    },
    abortOnLimit: true,
  }),
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/product", productRouter);

createTables();

app.use(errorMiddleware);

export default app;
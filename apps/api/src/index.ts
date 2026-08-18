import "dotenv/config";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { buildServer } from "./app.js";

const app = await buildServer();
await prisma.$connect();
await app.listen({ host: config.host, port: config.port });
console.log(`INTENTOS API http://${config.host}:${config.port}`);

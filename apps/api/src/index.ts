import "dotenv/config";
import { widenConnectionAttemptTimeout } from "./net.js";

// Must run before the first outbound socket is opened.
widenConnectionAttemptTimeout();

const { config } = await import("./config.js");
const { prisma } = await import("./db.js");
const { buildServer } = await import("./app.js");

const app = await buildServer();
await prisma.$connect();
await app.listen({ host: config.host, port: config.port });
app.log.info(`INTENTOS API listening on http://${config.host}:${config.port}`);

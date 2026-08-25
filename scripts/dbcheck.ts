import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.$queryRaw`SELECT VERSION() as v, DATABASE() as d`.then((r) => {
  console.log("DB_OK", JSON.stringify(r));
  return p.$disconnect();
}).catch((e) => { console.error("DB_FAIL", e.message); process.exit(1); });

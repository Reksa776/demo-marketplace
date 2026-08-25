import { prisma } from "../lib/prisma";
(async () => {
  try {
    const r = await prisma.affiliatePayout.aggregate({
      where: { affiliateId: 1, status: { in: ["PENDING", "PROCESSING", "APPROVED", "PAID"] as any[] } },
      _sum: { amount: true },
    });
    console.log("OK", r);
  } catch (e: any) {
    console.error("ERR", e.message.slice(0, 300));
  }
  const r2 = await prisma.$queryRawUnsafe<any[]>(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='AffiliatePayout' AND COLUMN_NAME='status'"
  );
  console.log(r2);
  await prisma.$disconnect();
})();

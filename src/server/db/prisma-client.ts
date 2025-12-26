/**
 * Prisma Client Helper
 * Initializes Prisma with D1 adapter for Cloudflare Workers
 */

import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export function getPrismaClient(env: any): any {
  if (!env?.DB) {
    throw new Error("D1 database not configured in environment");
  }

  return new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });
}

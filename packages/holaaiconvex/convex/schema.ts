import { defineSchema } from "convex/server";
import { commonTables } from "./common/schema";
import { creditsTables } from "./common/credits_schema";
import { holaaiTables } from "./holaai/schema";
import { lifeosTables } from "./lifeos/schema";

/**
 * Master Schema
 *
 * This schema composes tables from all domain modules:
 * - common: Shared tables (users, messages)
 * - credits: Credit/metering system tables (lifeos_userCredits, etc.)
 * - holaai: HolaAI Spanish learning app tables (hola_* prefix)
 * - lifeos: LifeOS personal productivity app tables (life_* prefix)
 */
export default defineSchema({
  ...commonTables,
  ...creditsTables,
  ...holaaiTables,
  ...lifeosTables,
});

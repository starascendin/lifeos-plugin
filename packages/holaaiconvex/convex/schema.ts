import { defineSchema } from "convex/server";
import { commonTables } from "./common/schema";
import { holaaiTables } from "./holaai/schema";
// import { lifeosTables } from "./lifeos/schema"; // Future

/**
 * Master Schema
 *
 * This schema composes tables from all domain modules:
 * - common: Shared tables (users, messages)
 * - holaai: HolaAI Spanish learning app tables (hola_* prefix)
 * - lifeos: Future LifeOS app tables (life_* prefix)
 */
export default defineSchema({
  ...commonTables,
  ...holaaiTables,
  // ...lifeosTables, // Future
});

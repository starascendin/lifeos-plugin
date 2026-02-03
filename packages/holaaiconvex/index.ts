// Re-export Convex API and types
export * from "./convex/_generated/api";
export type { Doc, Id, TableNames, DataModel } from "./convex/_generated/dataModel";

// Re-export constants (from client-safe modules)
export { DEFAULT_DAILY_PROMPT } from "./convex/lifeos/agenda_constants";

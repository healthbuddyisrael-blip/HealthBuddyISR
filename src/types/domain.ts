/** Persisted roles will be trusted only after server-side verification and RLS. */
export type UserRole = "admin" | "coach" | "trainee";

// Add database-generated types after the first schema migration.
// Do not invent a database schema or permissions in UI components.

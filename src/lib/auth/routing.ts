import type { UserRole } from "@/types/domain";

export function roleDestination(role: UserRole): "/app" | "/coach" | "/admin" {
  const destinations: Record<UserRole, "/app" | "/coach" | "/admin"> = {
    trainee: "/app",
    coach: "/coach",
    admin: "/admin",
  };
  return destinations[role];
}

export function roleForPath(path: string): UserRole | null {
  if (path === "/app" || path.startsWith("/app/")) return "trainee";
  if (path === "/coach" || path.startsWith("/coach/")) return "coach";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return null;
}

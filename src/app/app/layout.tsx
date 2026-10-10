import { requireRole } from "@/lib/auth/session";
export default async function TraineeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("trainee");
  return children;
}

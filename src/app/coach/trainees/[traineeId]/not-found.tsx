import { RecordNotFound } from "@/components/shared/record-not-found";
export default function NotFound() {
  return (
    <RecordNotFound
      title="המתאמן לא נמצא."
      href="/coach"
      label="חזרה למתאמנים שלי"
    />
  );
}

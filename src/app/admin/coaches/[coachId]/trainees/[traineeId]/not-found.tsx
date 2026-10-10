import { RecordNotFound } from "@/components/shared/record-not-found";
export default function NotFound() {
  return (
    <RecordNotFound
      title="המתאמן לא נמצא."
      href="/admin"
      label="חזרה לסקירת המערכת"
    />
  );
}

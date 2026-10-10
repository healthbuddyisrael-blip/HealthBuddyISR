"use client";
export function WorkoutInputs({
  strength,
  cardio,
  onStrength,
  onCardio,
  disabled,
  historicalUnknown,
}: {
  strength: boolean | null;
  cardio: boolean | null;
  onStrength: (value: boolean) => void;
  onCardio: (value: boolean) => void;
  disabled: boolean;
  historicalUnknown: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-1">
      <legend className="font-semibold">פעילות היום</legend>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="strength_workout_completed"
          checked={strength ?? false}
          onChange={(e) => onStrength(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        אימון כוח הושלם
      </label>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="cardio_workout_completed"
          checked={cardio ?? false}
          onChange={(e) => onCardio(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        אימון אירובי הושלם
      </label>
      {historicalUnknown && (
        <p className="text-sm text-muted-foreground">
          בדיווחים ישנים הפעילות אינה ידועה. שדות שלא שונו יישארו לא ידועים.
        </p>
      )}
    </fieldset>
  );
}

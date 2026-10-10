import { createElement as h } from "react";

// Presentation receives only email-safe fields, never an entire database record.
export type InvitationEmailProps = {
  role: "coach" | "trainee";
  invitationUrl: string;
  initialTargetSteps: number | null;
  validDays: number;
};
export function invitationSubject(role: InvitationEmailProps["role"]) {
  return role === "coach"
    ? "הוזמנת להצטרף ל-Health Buddy כמאמן"
    : "הוזמנת להצטרף ל-Health Buddy";
}
export function InvitationEmail({
  role,
  invitationUrl,
  initialTargetSteps,
  validDays,
}: InvitationEmailProps) {
  return h(
    "html",
    { lang: "he", dir: "rtl" },
    h(
      "head",
      null,
      h("meta", { charSet: "utf-8" }),
      h("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      }),
    ),
    h(
      "body",
      {
        style: {
          margin: 0,
          backgroundColor: "#f5f7f6",
          fontFamily: "Arial, sans-serif",
          color: "#162b25",
          direction: "rtl",
        },
      },
      h(
        "main",
        {
          style: {
            maxWidth: 560,
            margin: "24px auto",
            padding: 24,
            backgroundColor: "#ffffff",
            textAlign: "right",
          },
        },
        h(
          "h1",
          { style: { fontSize: 24 } },
          h("bdi", { dir: "ltr" }, "Health Buddy"),
        ),
        h("p", null, "שלום,"),
        h(
          "p",
          null,
          role === "coach"
            ? "הוזמנת להצטרף ל-Health Buddy כמאמן."
            : "המאמן שלך הזמין אותך להצטרף ל-Health Buddy למעקב אחר יעדי הצעדים שלך.",
        ),
        role === "trainee"
          ? h(
              "p",
              null,
              "יעד הצעדים היומי שהוגדר עבורך: ",
              h(
                "strong",
                null,
                h(
                  "bdi",
                  { dir: "ltr" },
                  initialTargetSteps?.toLocaleString("he-IL"),
                ),
                " צעדים",
              ),
            )
          : null,
        h("p", null, "להשלמת ההרשמה:"),
        h(
          "p",
          { style: { padding: "12px 0" } },
          h(
            "a",
            {
              href: invitationUrl,
              style: {
                display: "inline-block",
                padding: "16px 24px",
                backgroundColor: "#176447",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: 8,
              },
            },
            "השלמת הרשמה",
          ),
        ),
        h("p", null, `הקישור תקף למשך ${validDays} ימים.`),
        h("p", null, "אם לא ציפית להזמנה הזו, ניתן להתעלם מהמייל."),
      ),
    ),
  );
}

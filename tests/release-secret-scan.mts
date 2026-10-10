import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const patterns = [
  ["Supabase secret", /sb_secret_[A-Za-z0-9_-]{20,}/],
  ["Supabase CLI access token", /sbp_[A-Za-z0-9_-]{30,}/],
  ["Resend key", /re_[A-Za-z0-9]{25,}/],
  ["Google client secret", /GOCSPX-[A-Za-z0-9_-]{20,}/],
  [
    "Invitation bearer URL",
    /https?:\/\/[^\s"'<>]+\/invite\/[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/,
  ],
] as const;
const knownSecrets = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GMAIL_APP_PASSWORD",
  "AUTH_CONTEXT_SECRET",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "ADMIN_BOOTSTRAP_PASSWORD",
  "ADMIN_VERIFICATION_PASSWORD",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
]
  .flatMap((name) => {
    const value = process.env[name];
    return name === "GMAIL_APP_PASSWORD" && value
      ? [value, value.replace(/\s/g, "")]
      : [value];
  })
  .filter((value): value is string =>
    Boolean(
      value && value.length >= 8 && !/placeholder|test-only/i.test(value),
    ),
  );
const files: string[] = [];
function collect(directory: string) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile()) files.push(path);
  }
}
collect("src");
collect("supabase/migrations");
collect("docs");
collect(".next/static");
collect(".next/server");
for (const file of [
  ".env.example",
  "README.md",
  "next.config.mts",
  "package.json",
  "package-lock.json",
])
  if (existsSync(file)) files.push(file);
const findings: string[] = [];
for (const file of files) {
  if (statSync(file).size > 30_000_000)
    throw new Error("Oversized asset requires separate scan");
  const contents = readFileSync(file, "utf8");
  for (const [label, pattern] of patterns)
    if (pattern.test(contents)) findings.push(`${label}: ${file}`);
  for (const match of contents.matchAll(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  )) {
    try {
      if (
        JSON.parse(
          Buffer.from(match[0].split(".")[1] ?? "", "base64url").toString(),
        ).role === "service_role"
      )
        findings.push(`Service-role JWT: ${file}`);
    } catch {
      /* Not a decodable JWT. */
    }
  }
  if (knownSecrets.some((value) => contents.includes(value)))
    findings.push(`Configured secret in source/config/build file: ${file}`);
  if (file.startsWith(join(".next", "static"))) {
    for (const marker of [
      "GMAIL_APP_PASSWORD",
      "smtp.gmail.com",
      "nodemailer",
    ]) {
      if (contents.includes(marker))
        findings.push(`Server-only SMTP marker in browser asset: ${file}`);
    }
  }
}
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `PASS credential-pattern scan: ${files.length} current source/config/browser/server files. No secret values printed.`,
  );
}
console.log(
  `Known production secret comparison: ${knownSecrets.length ? "available environment values checked" : "unavailable (no real credentials configured)"}. Git history is not covered.`,
);

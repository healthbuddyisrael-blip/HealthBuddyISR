import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import { serverEnv } from "@/lib/env/server";
import type { EmailTransport } from "./delivery";

let transporter: Transporter<SMTPTransport.SentMessageInfo> | undefined;

export const gmailTransport: EmailTransport = async (email) => {
  // Lazy, process-local reuse. No SMTP connection/verification at import or build.
  transporter ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: serverEnv.GMAIL_USER, pass: serverEnv.GMAIL_APP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    dnsTimeout: 10_000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const info = await transporter.sendMail({
    from: serverEnv.EMAIL_FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    // Token-free correlation only: SMTP does not guarantee provider idempotency.
    messageId: `<${email.idempotencyKey.replace(/[^a-zA-Z0-9.-]/g, ".")}@${serverEnv.GMAIL_USER.split("@")[1]}>`,
  });
  const accepted = info.accepted.some(
    (recipient) => recipient.toLowerCase() === email.to.toLowerCase(),
  );
  if (!info.messageId || !accepted || info.rejected.length > 0) {
    throw new Error("invitation_delivery_failed");
  }
  return { messageId: info.messageId };
};

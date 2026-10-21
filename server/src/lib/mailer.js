import { BRAND } from "./brand.js";

/**
 * Outbound mail, with no third-party dependency.
 *
 * Two transports:
 *   - `console` (default) logs the message. Development and any host without
 *     mail credentials use this.
 *   - `webhook` POSTs `{ to, subject, text, html }` as JSON to MAIL_WEBHOOK_URL.
 *     That is enough for a transactional provider's inbound endpoint, and it
 *     keeps SMTP credentials out of this repo.
 *
 * `isConfigured()` tells the caller whether a real recipient would actually get
 * the message. While it returns false, the API also hands the reset link back to
 * the browser so the flow is still usable — that stops the moment a webhook is
 * configured.
 */

const TRANSPORT = (process.env.MAIL_TRANSPORT || "console").toLowerCase();
const WEBHOOK_URL = process.env.MAIL_WEBHOOK_URL || "";
const FROM = process.env.MAIL_FROM || `${BRAND.name} <no-reply@paceline.app>`;

export function isConfigured() {
  return TRANSPORT === "webhook" && !!WEBHOOK_URL;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The one template that exists today: password reset. */
export function resetEmail({ name, link }) {
  const safeName = escapeHtml(name || "there");
  const safeLink = escapeHtml(link);
  const safeBrand = escapeHtml(BRAND.name);

  const text = [
    `Hi ${name || "there"},`,
    "",
    `Someone asked to reset the password on your ${BRAND.name} account.`,
    `Set a new one here, within the next hour:`,
    "",
    link,
    "",
    `If this wasn't you, ignore this email — your password stays the same.`,
    "",
    `— ${BRAND.name}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#081413;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#081413;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f1f1d;border:1px solid #1d3330;border-radius:16px;padding:32px;">
            <tr>
              <td style="color:#6df5e3;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:16px;">
                ${safeBrand}
              </td>
            </tr>
            <tr>
              <td style="color:#e8fbf7;font-size:22px;font-weight:700;line-height:1.3;padding-bottom:12px;">
                Reset your password
              </td>
            </tr>
            <tr>
              <td style="color:#9db8b3;font-size:15px;line-height:1.6;padding-bottom:8px;">
                Hi ${safeName}, someone asked to reset the password on your ${safeBrand} account.
              </td>
            </tr>
            <tr>
              <td style="color:#9db8b3;font-size:15px;line-height:1.6;padding-bottom:24px;">
                The link works once and expires in one hour.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${safeLink}" style="display:inline-block;background:#6df5e3;color:#081413;font-size:15px;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px;">
                  Set a new password
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#6f8a85;font-size:12px;line-height:1.6;border-top:1px solid #1d3330;padding-top:16px;">
                If this wasn't you, ignore this email — your password stays the same.
                <br />
                If the button doesn't work, paste this into your browser:<br />
                <span style="color:#9db8b3;word-break:break-all;">${safeLink}</span>
              </td>
            </tr>
          </table>
          <p style="color:#49625e;font-size:11px;margin:16px 0 0;">
            ${safeBrand} · © ${BRAND.year}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: `Reset your ${BRAND.name} password`, text, html };
}

/** @returns {Promise<{ delivered: boolean }>} */
export async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    console.log(`[mail:console] to=${to} subject=${JSON.stringify(subject)}`);
    console.log(text);
    return { delivered: false };
  }

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MAIL_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.MAIL_WEBHOOK_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });

  if (!res.ok) {
    throw new Error(`Mail webhook failed (${res.status})`);
  }
  return { delivered: true };
}

export async function sendPasswordReset({ to, name, link }) {
  const { subject, text, html } = resetEmail({ name, link });
  return sendMail({ to, subject, text, html });
}

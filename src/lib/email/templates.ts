import type { EmailRecipient, RenderedEmail, SubmissionEmailContext } from "./types";
import { sanitizeAdminEmailHtml } from "./sanitize";

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] || character);
}

export function recipientName(recipient: EmailRecipient) {
  return recipient.name.trim().replace(/\s+/g, " ") || "Author";
}

export function formatManilaDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila"
  }).format(new Date(value));
}

export function renderSubmissionReceivedEmail(context: SubmissionEmailContext, recipient: EmailRecipient): RenderedEmail {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://talikhapublishing.vercel.app").replace(/\/$/, "");
  const trackingUrl = `${siteUrl}/track?reference=${encodeURIComponent(context.reference)}`;
  const subject = `Submission received: ${context.reference} — ${context.title}`;
  const submitted = formatManilaDate(context.submittedAt);
  const journalLine = `${context.journal}, Volume ${context.volume}, Issue ${context.issue}`;
  const greeting = recipientName(recipient);
  const text = [
    `Dear ${greeting},`,
    "",
    "We have successfully received your submission to Talikha Publishing.",
    "",
    `Reference number: ${context.reference}`,
    `Work: ${context.title}`,
    `Journal: ${journalLine}`,
    `Submitted: ${submitted} (Asia/Manila)`,
    "Current status: Received — awaiting editorial screening",
    "",
    "Please keep your reference number. You can use it at any time to check your submission:",
    trackingUrl,
    "",
    "This email confirms that the submission and required files were received. It does not mean the work has been accepted or that payment has been approved.",
    "",
    "If you contact the editorial office, include your reference number so we can locate the correct record.",
    "",
    "Sincerely,",
    "Talikha Publishing Editorial Office"
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f3eddf;color:#20362c;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">Your Talikha Publishing submission was received successfully.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3eddf"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #d8cfbd;border-radius:24px;overflow:hidden"><tr><td style="padding:30px 34px 24px;background:#173f32;color:#fff"><p style="margin:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#d4dfce">Talikha Publishing</p><h1 style="margin:0;font:normal 30px Georgia,serif">Submission received</h1></td></tr><tr><td style="padding:32px 34px"><p style="margin:0 0 20px">Dear ${escapeEmailHtml(greeting)},</p><p style="line-height:1.65;margin:0 0 22px">We have successfully received your submission to Talikha Publishing.</p><div style="padding:20px;border-radius:16px;background:#edf1e8;border-left:5px solid #b8664b"><p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#687468">Reference number</p><p style="margin:0;font:700 22px ui-monospace,monospace;color:#173f32">${escapeEmailHtml(context.reference)}</p></div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;font-size:14px;line-height:1.55"><tr><td style="padding:5px 10px 5px 0;color:#697269">Work</td><td style="padding:5px 0;font-weight:700">${escapeEmailHtml(context.title)}</td></tr><tr><td style="padding:5px 10px 5px 0;color:#697269">Journal</td><td style="padding:5px 0">${escapeEmailHtml(journalLine)}</td></tr><tr><td style="padding:5px 10px 5px 0;color:#697269">Submitted</td><td style="padding:5px 0">${escapeEmailHtml(submitted)} (Asia/Manila)</td></tr><tr><td style="padding:5px 10px 5px 0;color:#697269">Status</td><td style="padding:5px 0">Received — awaiting editorial screening</td></tr></table><p style="line-height:1.65">Please keep your reference number. You can use it at any time to check your submission.</p><p style="margin:24px 0"><a href="${escapeEmailHtml(trackingUrl)}" style="display:inline-block;padding:13px 20px;border-radius:999px;background:#b8664b;color:#fff;text-decoration:none;font-weight:700">Track your submission</a></p><p style="font-size:13px;line-height:1.6;color:#5f685f">This email confirms that the submission and required files were received. It does not mean the work has been accepted or that payment has been approved.</p><p style="line-height:1.65">If you contact the editorial office, include your reference number so we can locate the correct record.</p><p style="margin:26px 0 0;line-height:1.6">Sincerely,<br><strong>Talikha Publishing Editorial Office</strong></p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export function renderAdminEmail(subject: string, body: string, bodyHtml?: string): RenderedEmail {
  const safeBody = bodyHtml ? sanitizeAdminEmailHtml(bodyHtml) : escapeEmailHtml(body).replace(/\n/g, "<br>");
  return {
    subject,
    text: body,
    html: `<!doctype html><html><body style="margin:0;background:#f3eddf;color:#20362c;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3eddf"><tr><td align="center" style="padding:28px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #d8cfbd;border-radius:24px;overflow:hidden"><tr><td style="padding:28px 32px;border-bottom:4px solid #b8664b"><strong style="font:24px Georgia,serif;color:#173f32">Talikha Publishing</strong></td></tr><tr><td style="padding:30px 32px;line-height:1.7"><div style="overflow-wrap:anywhere">${safeBody}</div><p style="margin:28px 0 0">Sincerely,<br><strong>Talikha Publishing Editorial Office</strong></p></td></tr></table></td></tr></table></body></html>`
  };
}

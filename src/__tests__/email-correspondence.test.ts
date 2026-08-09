import { describe, expect, it } from "vitest";
import { resolveSubmissionRecipients } from "@/lib/email/recipients";
import { escapeEmailHtml, renderSubmissionReceivedEmail } from "@/lib/email/templates";
import { sanitizeImportedEmailHtml } from "@/lib/email/sanitize";

describe("submission correspondence", () => {
  it("normalizes and deduplicates every listed author while retaining the primary author", () => {
    const recipients = resolveSubmissionRecipients({
      author_name: "Primary Author",
      author_email: " PRIMARY@Example.com ",
      author_details: [
        { firstName: "Primary", surname: "Author", email: "primary@example.com" },
        { firstName: "Second", surname: "Writer", email: "SECOND@example.com" },
        { firstName: "Duplicate", surname: "Writer", email: "second@example.com" }
      ]
    });
    expect(recipients).toEqual([
      { email: "primary@example.com", name: "Primary Author" },
      { email: "second@example.com", name: "Second Writer" }
    ]);
  });

  it("escapes submission content and includes the reference and tracking link", () => {
    const recipient = { email: "author@example.com", name: "Ana <script>" };
    const result = renderSubmissionReceivedEmail({ submissionId: "submission", reference: "TAL-2026-ABC123", title: "A <b>Study</b>", journal: "InQuira", volume: "2", issue: "1", submittedAt: "2026-08-09T02:00:00.000Z", recipients: [recipient] }, recipient);
    expect(result.subject).toContain("TAL-2026-ABC123");
    expect(result.text).toContain("/track?reference=TAL-2026-ABC123");
    expect(result.html).not.toContain("A <b>Study</b>");
    expect(result.html).toContain("A &lt;b&gt;Study&lt;/b&gt;");
    expect(result.text).toContain("Dear Ana <script>,");
    expect(result.html).toContain("Dear Ana &lt;script&gt;,");
    expect(escapeEmailHtml("<>&\"")).toBe("&lt;&gt;&amp;&quot;");
  });

  it("removes active content and blocks automatic remote images from imported Gmail HTML", () => {
    const safe = sanitizeImportedEmailHtml('<script>alert(1)</script><form action="https://bad.test"><input></form><p>Hello</p><img src="https://tracker.test/pixel.gif"><a href="javascript:alert(2)">bad</a>');
    expect(safe).not.toContain("script");
    expect(safe).not.toContain("form");
    expect(safe).not.toContain("tracker.test");
    expect(safe).not.toContain("javascript:");
    expect(safe).toContain("Remote image blocked");
    expect(safe).toContain("Hello");
  });
});

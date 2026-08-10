import { describe, expect, it } from "vitest";
import { resolveSubmissionRecipients } from "@/lib/email/recipients";
import { escapeEmailHtml, renderSubmissionReceivedEmail } from "@/lib/email/templates";
import { sanitizeAdminEmailHtml, sanitizeImportedEmailHtml } from "@/lib/email/sanitize";
import { isPublicIpAddress, parseRemoteImageUrl } from "@/lib/email/remote-image";

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

  it("preserves safe email layout while removing active content and deferring remote images", () => {
    const safe = sanitizeImportedEmailHtml('<script>alert(1)</script><form action="https://bad.test"><input></form><table width="100%" style="max-width:620px;text-align:center;position:fixed;background-image:url(https://bad.test/x)"><tr><td align="center">Hello</td></tr></table><img src="https://tracker.test/pixel.gif"><a href="javascript:alert(2)">bad</a>');
    expect(safe).not.toContain("script");
    expect(safe).not.toContain("form");
    expect(safe).not.toContain("javascript:");
    expect(safe).not.toContain("position");
    expect(safe).not.toContain("background-image");
    expect(safe).toContain('width="100%"');
    expect(safe).toContain("max-width:620px");
    expect(safe).toContain('data-remote-src="https://tracker.test/pixel.gif"');
    expect(safe).not.toMatch(/<img[^>]+\ssrc="https:\/\/tracker\.test/);
    expect(safe).toContain("Hello");
  });

  it("retains embedded CID images and only permits HTTPS images in admin-authored HTML", () => {
    expect(sanitizeImportedEmailHtml('<img src="cid:logo@example" alt="Logo">')).toContain('src="cid:logo@example"');
    expect(sanitizeAdminEmailHtml('<p style="text-align:center"><img src="https://cdn.example/logo.png" onerror="alert(1)"></p>')).toContain('src="https://cdn.example/logo.png"');
    expect(sanitizeAdminEmailHtml('<img src="http://cdn.example/logo.png">')).not.toContain("http://cdn.example");
    expect(sanitizeAdminEmailHtml('<img src="data:image/png;base64,AAAA">')).not.toContain("data:image");
  });

  it("allows public HTTPS email images and rejects private or unsafe image hosts", () => {
    expect(parseRemoteImageUrl("https://persistent.oaistatic.com/chatgpt/icons/chatgpt_logo.png").hostname).toBe("persistent.oaistatic.com");
    expect(parseRemoteImageUrl("http://images.example.com/logo.png").protocol).toBe("https:");
    expect(() => parseRemoteImageUrl("https://127.0.0.1/logo.png")).toThrow();
    expect(() => parseRemoteImageUrl("https://metadata.internal/logo.png")).toThrow();
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("10.0.0.1")).toBe(false);
    expect(isPublicIpAddress("::1")).toBe(false);
  });
});

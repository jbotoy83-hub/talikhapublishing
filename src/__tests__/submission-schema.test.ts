import { describe, expect, it } from "vitest";
import { submissionCompleteSchema, submissionFileRules, submissionInitSchema } from "@/lib/submission";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function manuscriptFile(overrides: Record<string, unknown> = {}) {
  return { key: "manus01", field: "manuscript" as const, name: "paper.pdf", type: "application/pdf", size: 100_000, ...overrides };
}

function paymentFile(overrides: Record<string, unknown> = {}) {
  return { key: "paym01", field: "paymentProof" as const, name: "receipt.png", type: "image/png", size: 50_000, ...overrides };
}

function authorPhotoFile(overrides: Record<string, unknown> = {}) {
  return { key: "photo01", field: "authorPhoto" as const, name: "author.jpg", type: "image/jpeg", size: 50_000, ...overrides };
}

function makeValidInit(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: UUID_A,
    workingTitle: "A valid working title",
    publicationType: "Manuscript",
    journalId: UUID_B,
    issueId: UUID_C,
    authorDetails: [{ firstName: "Jane", surname: "Doe", middleInitial: "", position: "", academicTitle: "", email: "jane@example.com", institution: "", location: "", orcid: "" }],
    authorName: "Jane Doe",
    authorEmail: "jane@example.com",
    consent: true,
    files: [manuscriptFile(), paymentFile()],
    paymentMethod: "GCash",
    paymentReference: "REF123456",
    ...overrides
  };
}

function messages(result: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return result.success ? [] : (result.error?.issues ?? []).map((i) => i.message);
}

describe("submissionFileRules", () => {
  it("defines manuscript limits (15 MB; doc/pdf types)", () => {
    expect(submissionFileRules.manuscript.max).toBe(15 * 1024 * 1024);
    expect(submissionFileRules.manuscript.types).toContain("application/pdf");
    expect(submissionFileRules.manuscript.types).toContain("application/msword");
    expect(submissionFileRules.manuscript.types).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  it("defines authorPhoto limits (5 MB; jpeg/png only)", () => {
    expect(submissionFileRules.authorPhoto.max).toBe(5 * 1024 * 1024);
    expect(submissionFileRules.authorPhoto.types).toEqual(["image/jpeg", "image/png"]);
  });

  it("defines paymentProof limits (5 MB; jpeg/png/webp/pdf)", () => {
    expect(submissionFileRules.paymentProof.max).toBe(5 * 1024 * 1024);
    expect(submissionFileRules.paymentProof.types).toEqual(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  });
});

describe("submissionInitSchema", () => {
  it("accepts a valid payload and applies defaults", () => {
    const result = submissionInitSchema.safeParse(makeValidInit());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.preferredJournal).toBe("");
    expect(result.data.affiliation).toBe("");
    expect(result.data.phone).toBe("");
    expect(result.data.notes).toBe("");
    expect(result.data.turnstileToken).toBe("");
    expect(result.data.website).toBe("");
    expect(result.data.publicationPlan).toBe("");
    expect(result.data.promoCode).toBe("");
    expect(result.data.paymentTotal).toBe(0);
  });

  it("requires a UUID idempotencyKey", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ idempotencyKey: UUID_A })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ idempotencyKey: "not-a-uuid" })).success).toBe(false);
    const missing = makeValidInit();
    delete (missing as Record<string, unknown>).idempotencyKey;
    expect(submissionInitSchema.safeParse(missing).success).toBe(false);
  });

  it("trims workingTitle and enforces min 5 / max 300", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ workingTitle: "  ab  " })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ workingTitle: "short" })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ workingTitle: "x".repeat(301) })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ workingTitle: "x".repeat(300) })).success).toBe(true);
  });

  it("accepts journal-defined publication types within the server limits", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ publicationType: "Research article" })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ publicationType: "Blog post" })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ publicationType: "   " })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ publicationType: "x".repeat(121) })).success).toBe(false);
  });

  it("requires UUID journalId and issueId", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ journalId: "nope" })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ issueId: "nope" })).success).toBe(false);
  });

  it("requires consent to be literally true", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ consent: true })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ consent: false })).success).toBe(false);
  });

  it("treats a non-empty website (honeypot) as invalid", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ website: "" })).success).toBe(true);
    expect(submissionInitSchema.safeParse(makeValidInit({ website: "http://spam.example" })).success).toBe(false);
  });

  it("validates author emails and authorDetails bounds", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ authorEmail: "not-an-email" })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ authorDetails: [] })).success).toBe(false);
    const author = { firstName: "Jane", surname: "Doe", middleInitial: "", position: "", academicTitle: "", email: "jane@example.com", institution: "", location: "", orcid: "" };
    expect(submissionInitSchema.safeParse(makeValidInit({ authorDetails: Array.from({ length: 13 }, () => ({ ...author })) })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ authorDetails: Array.from({ length: 12 }, () => ({ ...author })) })).success).toBe(true);
  });

  it("enforces payment method/reference minimums with custom messages", () => {
    const shortMethod = submissionInitSchema.safeParse(makeValidInit({ paymentMethod: "G" }));
    expect(shortMethod.success).toBe(false);
    expect(messages(shortMethod)).toContain("Choose or enter the payment method.");
    const shortRef = submissionInitSchema.safeParse(makeValidInit({ paymentReference: "AB" }));
    expect(shortRef.success).toBe(false);
    expect(messages(shortRef)).toContain("Enter the payment reference number.");
  });

  it("rejects a paymentTotal below zero", () => {
    expect(submissionInitSchema.safeParse(makeValidInit({ paymentTotal: -1 })).success).toBe(false);
    expect(submissionInitSchema.safeParse(makeValidInit({ paymentTotal: 0 })).success).toBe(true);
  });

  describe("file validation (superRefine)", () => {
    it("requires exactly one manuscript", () => {
      const none = submissionInitSchema.safeParse(makeValidInit({ files: [paymentFile()] }));
      expect(none.success).toBe(false);
      expect(messages(none)).toContain("A manuscript file is required.");
      const two = submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile({ key: "manus01" }), manuscriptFile({ key: "manus02" }), paymentFile()] }));
      expect(two.success).toBe(false);
      expect(messages(two)).toContain("A manuscript file is required.");
    });

    it("requires exactly one proof of payment", () => {
      const none = submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile()] }));
      expect(none.success).toBe(false);
      expect(messages(none)).toContain("One proof of payment is required.");
    });

    it("allows zero or more author photos", () => {
      expect(submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile(), paymentFile()] })).success).toBe(true);
      expect(submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile(), paymentFile(), authorPhotoFile()] })).success).toBe(true);
    });

    it("flags files exceeding their per-field size limit", () => {
      const result = submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile(), paymentFile(), authorPhotoFile({ size: 6 * 1024 * 1024 })] }));
      expect(result.success).toBe(false);
      expect(messages(result)).toContain("authorPhoto exceeds the allowed upload size.");
    });

    it("flags unsupported per-field file types", () => {
      const result = submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile(), paymentFile(), authorPhotoFile({ type: "application/pdf" })] }));
      expect(result.success).toBe(false);
      expect(messages(result)).toContain("authorPhoto has an unsupported file type.");
    });

    it("validates the file key format", () => {
      expect(submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile({ key: "ab" }), paymentFile()] })).success).toBe(false);
      expect(submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile({ key: "bad!key" }), paymentFile()] })).success).toBe(false);
    });

    it("caps the file list at 14 entries", () => {
      const photos = Array.from({ length: 13 }, (_, i) => authorPhotoFile({ key: `photo${String(i).padStart(2, "0")}` }));
      const result = submissionInitSchema.safeParse(makeValidInit({ files: [manuscriptFile(), paymentFile(), ...photos] }));
      expect(result.success).toBe(false);
    });
  });
});

describe("submissionCompleteSchema", () => {
  function makeValidComplete(overrides: Record<string, unknown> = {}) {
    return {
      submissionId: UUID_A,
      uploads: [
        { field: "manuscript" as const, path: `${UUID_A}/manuscript/abc-paper.pdf` },
        { field: "paymentProof" as const, path: `${UUID_A}/paymentProof/abc-receipt.png` }
      ],
      ...overrides
    };
  }

  it("accepts a valid completion", () => {
    expect(submissionCompleteSchema.safeParse(makeValidComplete()).success).toBe(true);
  });

  it("requires a UUID submissionId", () => {
    expect(submissionCompleteSchema.safeParse(makeValidComplete({ submissionId: "nope" })).success).toBe(false);
  });

  it("requires exactly one manuscript upload", () => {
    const result = submissionCompleteSchema.safeParse(makeValidComplete({ uploads: [{ field: "paymentProof", path: `${UUID_A}/paymentProof/abc-receipt.png` }] }));
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("A manuscript file is required.");
  });

  it("requires exactly one payment proof upload", () => {
    const result = submissionCompleteSchema.safeParse(makeValidComplete({ uploads: [{ field: "manuscript", path: `${UUID_A}/manuscript/abc-paper.pdf` }] }));
    expect(result.success).toBe(false);
    expect(messages(result)).toContain("One proof of payment is required.");
  });

  it("enforces upload path length bounds", () => {
    expect(submissionCompleteSchema.safeParse(makeValidComplete({ uploads: [{ field: "manuscript", path: "ab" }, { field: "paymentProof", path: `${UUID_A}/paymentProof/abc-receipt.png` }] })).success).toBe(false);
  });
});

import { z } from "zod";

export const submissionFileRules = {
  manuscript: {
    max: 15 * 1024 * 1024,
    types: ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/pdf"]
  },
  authorPhoto: {
    max: 5 * 1024 * 1024,
    types: ["image/jpeg", "image/png"]
  },
  paymentProof: {
    max: 5 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  }
} as const;

const submissionFileFieldSchema = z.enum(["manuscript", "authorPhoto", "paymentProof"]);
export type SubmissionFileField = z.infer<typeof submissionFileFieldSchema>;

const fileDescriptorSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{6,80}$/),
  field: submissionFileFieldSchema,
  name: z.string().min(1).max(180),
  type: z.string().min(1).max(120),
  size: z.number().int().positive().max(15 * 1024 * 1024)
});

function validateFileFields(
  files: Array<{ field: SubmissionFileField; type?: string; size?: number }>,
  ctx: z.RefinementCtx,
  path: "files" | "uploads"
) {
  const counts = new Map<SubmissionFileField, number>();
  files.forEach((file, index) => {
    counts.set(file.field, (counts.get(file.field) || 0) + 1);

    if (file.type !== undefined && file.size !== undefined) {
      const rule = submissionFileRules[file.field];
      if (file.size > rule.max) {
        ctx.addIssue({ code: "custom", path: [path, index, "size"], message: `${file.field} exceeds the allowed upload size.` });
      }
      if (!(rule.types as readonly string[]).includes(file.type)) {
        ctx.addIssue({ code: "custom", path: [path, index, "type"], message: `${file.field} has an unsupported file type.` });
      }
    }
  });

  if (counts.get("manuscript") !== 1) {
    ctx.addIssue({ code: "custom", path: [path], message: "A manuscript file is required." });
  }
  if ((counts.get("paymentProof") || 0) > 1) ctx.addIssue({ code: "custom", path: [path], message: "Only one proof of payment can be uploaded." });
}

export const submissionInitSchema = z.object({
  workingTitle: z.string().trim().min(5).max(300),
  publicationType: z.enum(["Manuscript", "Research article", "Essay or commentary", "Poetry", "Fiction", "Creative nonfiction", "Book manuscript", "Research Article", "Essay", "Book Chapter", "Literary Review", "Commentary"]),
  preferredJournal: z.string().trim().max(100).optional().default(""),
  journalId: z.uuid(),
  issueId: z.uuid(),
  authorDetails: z.array(z.object({ firstName: z.string().trim().min(1).max(80), surname: z.string().trim().min(1).max(80), middleInitial: z.string().trim().max(80), position: z.string().trim().max(160), academicTitle: z.string().trim().max(80), email: z.email().max(254), institution: z.string().trim().max(240), location: z.string().trim().max(240), orcid: z.string().trim().max(120) })).min(1).max(12),
  authorName: z.string().trim().min(2).max(180),
  authorEmail: z.email().max(254),
  affiliation: z.string().trim().max(240).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
  consent: z.literal(true),
  turnstileToken: z.string().max(2048).optional().default(""),
  website: z.string().max(0).optional().default(""),
  files: z.array(fileDescriptorSchema).min(1).max(14)
}).superRefine(({ files }, ctx) => validateFileFields(files, ctx, "files"));

export const submissionCompleteSchema = z.object({
  submissionId: z.uuid(),
  uploads: z.array(z.object({ field: submissionFileFieldSchema, path: z.string().min(3).max(500) })).min(1).max(14)
}).superRefine(({ uploads }, ctx) => validateFileFields(uploads, ctx, "uploads"));

import { z } from "zod";
import { isApiError, requireEditorApi } from "@/lib/admin-api";
import { manuscriptApiError, readSizedJson, requireSameOrigin } from "@/lib/manuscript-api";
import { previewManuscript } from "@/lib/manuscripts";

const previewSchema = z.object({ format: z.enum(["docx", "pdf"]) });

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  const user = await requireEditorApi();
  if (isApiError(user)) return user;
  try {
    const { id } = await params;
    const { format } = previewSchema.parse(await readSizedJson(request, 16 * 1024));
    const bytes = await previewManuscript(z.string().uuid().parse(id), format);
    const headers = new Headers({
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="manuscript-preview.${format}"`,
      "Cache-Control": "private, no-store",
    });
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    return manuscriptApiError(error, "The manuscript preview could not be generated.");
  }
}

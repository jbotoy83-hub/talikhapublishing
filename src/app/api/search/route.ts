import { NextResponse, type NextRequest } from "next/server";
import { searchPublications, type SearchFilters } from "@/lib/search";
import { allowRequest, getRequestRateLimitKey } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getRequestRateLimitKey(request.headers);
  if (!await allowRequest(`search:${ip}`, 30, 60 * 1000)) return NextResponse.json({ error: "Too many searches. Please wait." }, { status: 429 });

  const params = request.nextUrl.searchParams;
  const filters: SearchFilters = {
    q: params.get("q") || undefined,
    journal: params.get("journal") || undefined,
    year: params.get("year") || undefined,
    type: params.get("type") || undefined,
    keyword: params.get("keyword") || undefined,
    sort: (params.get("sort") as SearchFilters["sort"]) || undefined,
    page: Number(params.get("page")) || 1
  };

  try {
    const result = await searchPublications(filters);
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Search is temporarily unavailable." }, { status: 500 });
  }
}

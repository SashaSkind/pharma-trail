import { NextRequest, NextResponse } from "next/server";
import { explore } from "@/lib/ch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const drug = sp.get("drug") ?? "Eliquis";
  const specialty = sp.get("specialty") ?? "";
  const minClms = Number(sp.get("minClms") ?? 0);
  const payMin = Number(sp.get("payMin") ?? 0);
  const payMax = sp.get("payMax") ? Number(sp.get("payMax")) : 1e12;
  try {
    const result = await explore({ drug, specialty, minClms, payMin, payMax });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

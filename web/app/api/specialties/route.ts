import { NextRequest, NextResponse } from "next/server";
import { specialtiesForDrug } from "@/lib/ch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const drug = req.nextUrl.searchParams.get("drug") ?? "Eliquis";
  try {
    return NextResponse.json({ specialties: await specialtiesForDrug(drug) });
  } catch (e) {
    return NextResponse.json({ specialties: [], error: String(e) }, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot charge Account Balance." }, { status: 403 });
  }
  return NextResponse.json({ error: "Charging Account Balance is not implemented yet." }, { status: 501 });
}

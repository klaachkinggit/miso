import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (profile.role === "controller") {
    return NextResponse.json({ error: "Controllers cannot cash out Account Balance." }, { status: 403 });
  }
  return NextResponse.json({ error: "Cashout is not implemented yet." }, { status: 501 });
}

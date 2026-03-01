import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const pricingCategory = searchParams.get("pricingCategory") || undefined;
    const listingType = searchParams.get("listingType") || undefined;
    const search = searchParams.get("search") || undefined;
    const creatorId = searchParams.get("creatorId") || undefined;
    const services = await storage.getServices({ category, pricingCategory, listingType, search, creatorId });
    return NextResponse.json(services);
  } catch {
    return NextResponse.json(await storage.getServices());
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitResponse = checkRateLimit(ip, "create-service", 30, 60000);
  if (rateLimitResponse) return rateLimitResponse;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sellerProfile = await storage.getProfile(user.id);
  if (!sellerProfile?.twitterVerified) {
    return NextResponse.json(
      { message: "You must verify your X (Twitter) handle before creating a service." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const input = api.services.create.input.parse(body);
    const service = await storage.createService({
      ...input,
      creatorId: user.id,
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        message: err.errors[0].message,
        field: err.errors[0].path.join('.'),
      }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

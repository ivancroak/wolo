import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const listingType = searchParams.get("listingType") || undefined;
    const search = searchParams.get("search") || undefined;
    const services = await storage.getServices({ category, listingType, search });
    return NextResponse.json(services);
  } catch {
    return NextResponse.json(await storage.getServices());
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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
    throw err;
  }
}

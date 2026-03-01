import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { insertServiceSchema } from "@shared/schema";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

const updateServiceSchema = insertServiceSchema.omit({ creatorId: true }).partial().omit({ active: true });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const service = await storage.getService(Number(id));
  if (!service) {
    return NextResponse.json({ message: "Service not found" }, { status: 404 });
  }
  return NextResponse.json(service);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "service-update", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);
  if (isNaN(serviceId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const service = await storage.getService(serviceId);
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const validated = updateServiceSchema.parse(body);
    const updated = await storage.updateService(serviceId, user.id, validated);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message, field: err.errors[0].path.join('.') }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(_request);
  const rl = checkRateLimit(ip, "service-delete", 20, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);
  if (isNaN(serviceId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const service = await storage.getService(serviceId);
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await storage.deleteService(serviceId, user.id);
  return NextResponse.json({ success: true });
}

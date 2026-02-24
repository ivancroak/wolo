import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";

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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const serviceId = parseInt(id);
  if (isNaN(serviceId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const service = await storage.getService(serviceId);
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.creatorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const updated = await storage.updateService(serviceId, user.id, body);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

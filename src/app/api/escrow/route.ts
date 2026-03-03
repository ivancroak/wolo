import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/server/with-rate-limit";

const DISPUTE_WINDOW_HOURS = 48;
const MAX_ESCROW_DAYS = 365;

function computePayrollPeriods(
  totalPeriods: number,
  basis: "weekly" | "monthly",
  amountPerPeriod: string,
) {
  const now = new Date();
  const periods: { periodNumber: number; startsAt: Date; endsAt: Date; disputeDeadline: Date; amount: string }[] = [];
  for (let i = 0; i < totalPeriods; i++) {
    const startsAt = new Date(now);
    const endsAt = new Date(now);
    if (basis === "weekly") {
      startsAt.setDate(now.getDate() + i * 7);
      endsAt.setDate(now.getDate() + (i + 1) * 7);
    } else {
      startsAt.setMonth(now.getMonth() + i);
      endsAt.setMonth(now.getMonth() + i + 1);
    }
    const disputeDeadline = new Date(endsAt.getTime() + DISPUTE_WINDOW_HOURS * 3600000);
    periods.push({ periodNumber: i + 1, startsAt, endsAt, disputeDeadline, amount: amountPerPeriod });
  }
  return periods;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, "create-escrow", 10, 60000);
  if (rl) return rl;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = api.escrow.create.input.parse(body);
    const totalPeriods: number | undefined = body.totalPeriods;

    const order = await storage.getOrder(input.orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 400 });
    }

    if (order.buyerId !== user.id) {
      return NextResponse.json({ message: "Only the buyer can create an escrow" }, { status: 403 });
    }

    const service = await storage.getService(order.serviceId);
    if (!service) {
      return NextResponse.json({ message: "Service not found" }, { status: 400 });
    }

    if (user.id === service.creatorId) {
      return NextResponse.json({ message: "Cannot create escrow for your own service" }, { status: 400 });
    }

    const expectedReceiver = service.listingType === "request" ? order.buyerId : service.creatorId;
    if (input.receiverId !== expectedReceiver) {
      return NextResponse.json({ message: "Receiver does not match service creator" }, { status: 400 });
    }

    const isPayroll = service.pricingCategory === "payroll" && !!totalPeriods;

    if (isPayroll) {
      if (!Number.isInteger(totalPeriods) || totalPeriods < 1 || totalPeriods > 52) {
        return NextResponse.json({ message: "totalPeriods must be 1-52" }, { status: 400 });
      }
      const expectedTotal = (Number(service.price) * totalPeriods).toFixed(9).replace(/\.?0+$/, "");
      const inputAmount = Number(input.amount).toFixed(9).replace(/\.?0+$/, "");
      if (inputAmount !== expectedTotal) {
        return NextResponse.json({ message: `Amount must be ${expectedTotal} SOL (${service.price} × ${totalPeriods})` }, { status: 400 });
      }
      const basis = service.payrollBasis ?? "weekly";
      const periodDays = basis === "weekly" ? 7 : 30;
      const totalDays = periodDays * totalPeriods + 30;
      if (totalDays > MAX_ESCROW_DAYS) {
        return NextResponse.json({ message: `Payroll contract exceeds max ${MAX_ESCROW_DAYS}-day escrow duration` }, { status: 400 });
      }
    } else {
      if (input.amount !== service.price) {
        return NextResponse.json({ message: "Amount does not match service price" }, { status: 400 });
      }
    }

    const existingEscrow = await storage.getEscrowByOrder(input.orderId);
    if (existingEscrow) {
      return NextResponse.json({ message: "Escrow already exists for this order" }, { status: 400 });
    }

    const escrowInput: any = {
      ...input,
      depositorId: user.id,
    };

    if (isPayroll) {
      const basis = service.payrollBasis ?? "weekly";
      const periodDays = basis === "weekly" ? 7 : 30;
      escrowInput.expiresInDays = Math.min(periodDays * totalPeriods + 30, MAX_ESCROW_DAYS);
      escrowInput.isRecurring = true;
      escrowInput.payrollBasis = basis;
      escrowInput.totalPeriods = totalPeriods;
      escrowInput.amountPerPeriod = service.price;
    }

    const escrow = await storage.createEscrow(escrowInput);

    if (isPayroll) {
      const basis = service.payrollBasis ?? "weekly";
      const periods = computePayrollPeriods(totalPeriods!, basis as "weekly" | "monthly", service.price);
      await storage.createPayrollPeriods(escrow.id, periods);
    }

    return NextResponse.json(escrow, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      }, { status: 400 });
    }
    console.error("Route error:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

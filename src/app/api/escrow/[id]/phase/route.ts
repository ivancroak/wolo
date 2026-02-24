import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { getSessionUser } from "@/server/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import type { EscrowPhase } from "@shared/schema";
import { notify } from "@/server/notifications";

const VALID_TRANSITIONS: Record<string, { phases: EscrowPhase[]; by: "depositor" | "receiver" | "both" }[]> = {
  awaiting_deposit: [{ phases: ["funded"], by: "depositor" }],
  funded: [
    { phases: ["in_progress"], by: "receiver" },
    { phases: ["disputed"], by: "depositor" },
  ],
  in_progress: [
    { phases: ["under_review"], by: "receiver" },
    { phases: ["milestone_check"], by: "both" },
    { phases: ["disputed"], by: "depositor" },
  ],
  under_review: [
    { phases: ["released"], by: "depositor" },
    { phases: ["disputed"], by: "depositor" },
  ],
  milestone_check: [
    { phases: ["in_progress"], by: "both" },
    { phases: ["released"], by: "depositor" },
    { phases: ["disputed"], by: "depositor" },
  ],
  disputed: [
    { phases: ["refunded"], by: "depositor" },
    { phases: ["released"], by: "depositor" },
  ],
  released: [],
  refunded: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const escrow = await storage.getEscrow(Number(id));
  if (!escrow) {
    return NextResponse.json({ message: "Escrow not found" }, { status: 404 });
  }

  if (escrow.depositorId !== user.id && escrow.receiverId !== user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const input = api.escrow.updatePhase.input.parse(body);

    const allowedTransitions = VALID_TRANSITIONS[escrow.phase] ?? [];
    const matchingRule = allowedTransitions.find(rule => rule.phases.includes(input.phase));

    if (!matchingRule) {
      return NextResponse.json({
        message: `Cannot transition from '${escrow.phase}' to '${input.phase}'`,
      }, { status: 400 });
    }

    const isDepositor = user.id === escrow.depositorId;
    const isReceiver = user.id === escrow.receiverId;
    if (matchingRule.by === "depositor" && !isDepositor) {
      return NextResponse.json({ message: "Only the depositor can perform this transition" }, { status: 403 });
    }
    if (matchingRule.by === "receiver" && !isReceiver) {
      return NextResponse.json({ message: "Only the receiver can perform this transition" }, { status: 403 });
    }

    const updated = await storage.updateEscrowPhase(escrow.id, input.phase, input.txHash);

    const targetId = user.id === escrow.depositorId ? escrow.receiverId : escrow.depositorId;
    const phaseNotifications: Partial<Record<EscrowPhase, { type: "escrow_funded" | "escrow_released" | "escrow_disputed"; body: string }>> = {
      funded: { type: "escrow_funded", body: "Escrow has been funded" },
      released: { type: "escrow_released", body: "Escrow funds have been released" },
      disputed: { type: "escrow_disputed", body: "Escrow has been disputed" },
    };
    const info = phaseNotifications[input.phase];
    if (info) {
      await notify(targetId, info.type, "Escrow Update", info.body, "/dashboard");
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0].message }, { status: 400 });
    }
    throw err;
  }
}

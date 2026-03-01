import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS;
  if (!ADMIN_WALLET) {
    return NextResponse.json({ message: "ADMIN_WALLET_ADDRESS not configured" }, { status: 500 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (user.id !== ADMIN_WALLET) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("escrows")
    .select("*")
    .eq("phase", "disputed")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const escrows = (data ?? []).map((row: any) => ({
    id: row.id,
    orderId: row.order_id,
    depositorId: row.depositor_id,
    receiverId: row.receiver_id,
    amount: row.amount,
    phase: row.phase,
    depositTxHash: row.deposit_tx_hash,
    releaseTxHash: row.release_tx_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json(escrows);
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const ADMIN_WALLET = "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";

export async function GET() {
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

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/authz";
import { markOrderFulfilled } from "@/lib/orders";

// PAID → FULFILLED. Guarded by the fulfillOrders capability inside the action
// (per AGENTS #1), not just the admin layout — so ADMIN and FULFILLMENT can run
// it, no one else. Only a status transition; no money fields change.
export async function markFulfilled(formData: FormData) {
  await requireCapability("fulfillOrders");
  const id = String(formData.get("id") || "");
  if (!id) return;
  await markOrderFulfilled(prisma, id);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

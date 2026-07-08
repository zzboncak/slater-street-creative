"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { markOrderFulfilled } from "@/lib/orders";

// PAID → FULFILLED. Guarded by requireAdmin() inside the action (per AGENTS #1),
// not just the admin layout. Only a status transition — no money fields change.
export async function markFulfilled(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await markOrderFulfilled(prisma, id);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}

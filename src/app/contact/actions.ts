"use server";

export type ContactFormState = {
  ok?: boolean;
  error?: string;
  // echo back some fields for optimistic UI if needed later
  values?: {
    name?: string;
    email?: string;
    category?: string;
    scentName?: string;
    message?: string;
  };
};

function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

export async function submitContact(
  prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  // Basic honeypot
  if (formData.get("website")) {
    return { ok: true }; // silently ignore bots
  }
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const category = String(formData.get("category") || "general");
  const scentName = String(formData.get("scentName") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!name)
    return {
      error: "Name is required",
      values: { name, email, category, scentName, message },
    };
  if (!email || !isValidEmail(email))
    return {
      error: "Valid email is required",
      values: { name, email, category, scentName, message },
    };
  if (!message)
    return {
      error: "Message is required",
      values: { name, email, category, scentName, message },
    };
  if (category === "scent" && !scentName)
    return {
      error: "Suggested scent name required",
      values: { name, email, category, scentName, message },
    };

  // Simulate async processing (e.g. persisting, sending mail)
  await new Promise((r) => setTimeout(r, 400));

  // For now we just log server-side; replace with email / queue integration later
  console.log("[contact] submission", {
    name,
    email,
    category,
    scentName,
    message,
  });

  return { ok: true };
}

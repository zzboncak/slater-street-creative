"use client";

// A delete form that confirms before submitting. The `confirm()` runs in an
// onSubmit handler, which is a client-only event handler — so it lives in this
// client component. A Server Component can't attach onSubmit to a <form> (it
// throws "Event handlers cannot be passed to Client Component props"), which is
// what 500'd /admin/coupons before SSC-33. The `action` is a Server Action passed
// down as a prop (a supported pattern), so the actual delete still runs server-side.
export default function ConfirmDeleteForm({
  action,
  id,
  confirmText = "Delete this?",
  label = "Delete",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  confirmText?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-red-600 underline">{label}</button>
    </form>
  );
}

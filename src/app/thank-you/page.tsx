export const metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

import ClearCartOnMount from "./safe-clear";

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-3xl font-semibold">Thank you!</h1>
      <p>
        Your order has been received. A confirmation email will be sent shortly.
      </p>
      {/* Clear cart once when redirected from checkout */}
      <ClearCartOnMount />
    </div>
  );
}

export const metadata = { title: "Thank you" };

export default function ThankYouPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-4">
      <h1 className="text-3xl font-semibold">Thank you!</h1>
      <p>Your order has been received. A confirmation email will be sent shortly.</p>
    </div>
  );
}

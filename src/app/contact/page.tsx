"use client";

export const dynamic = "force-dynamic";

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Contact Us</h1>
        <p className="text-gray-600 text-lg">
          For orders, inquiries, or custom scent blends, contact{" "}
          <a
            href="mailto:info@slaterstreetcreative.com"
            className="text-blue-600 underline"
          >
            info@slaterstreetcreative.com
          </a>
          .
        </p>
      </header>
    </div>
  );
}

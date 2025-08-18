"use client";
import { submitContact, type ContactFormState } from './actions';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

export const dynamic = 'force-dynamic';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded bg-black text-white px-4 py-2 disabled:opacity-50">
      {pending ? 'Sending…' : 'Send message'}
    </button>
  );
}

export default function ContactPage() {
  const initialState: ContactFormState = {};
  const [state, formAction] = useActionState(submitContact, initialState);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Contact Us</h1>
        <p className="text-gray-600">General questions, order feedback, or pitch your dream candle scent.</p>
      </header>

      {state.ok && (
        <div className="rounded border border-green-300 bg-green-50 text-green-800 px-4 py-3 text-sm">
          Thanks! Your message has been received.
        </div>
      )}
      {state.error && (
        <div className="rounded border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Honeypot */}
        <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input id="name" name="name" required className="w-full border rounded px-3 py-2" defaultValue={state.values?.name} />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" defaultValue={state.values?.email} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="category" className="text-sm font-medium">Category</label>
            <select id="category" name="category" className="w-full border rounded px-3 py-2" defaultValue={state.values?.category || 'general'}>
              <option value="general">General Inquiry</option>
              <option value="order">Order Question</option>
              <option value="scent">Suggest a Scent</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="scentName" className="text-sm font-medium flex items-center gap-2">Scent Name <span className="text-xs text-gray-500">(if suggesting)</span></label>
            <input id="scentName" name="scentName" className="w-full border rounded px-3 py-2" defaultValue={state.values?.scentName} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="message" className="text-sm font-medium">Message</label>
            <textarea id="message" name="message" rows={6} required className="w-full border rounded px-3 py-2" defaultValue={state.values?.message} />
          </div>
        </div>
        <SubmitButton />
      </form>

      <section className="pt-8 border-t">
        <h2 className="text-xl font-medium mb-2">What happens next?</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          <li>We’ll review your message shortly.</li>
          <li>Scent suggestions are evaluated monthly.</li>
          <li>For order-specific issues include your order ID.</li>
        </ul>
      </section>
    </div>
  );
}

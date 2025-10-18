export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 space-y-6">
      <h1 className="text-3xl font-semibold mb-12">
        About Slater Street Creative
      </h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-medium mb-4">
            All of our candles feature:
          </h2>
          <ul className="space-y-2 list-disc pl-6 text-lg">
            <li>All-natural, U.S.-grown soy wax</li>
            <li>Lead-free cotton wicks</li>
            <li>Vegan and cruelty-free ingredients</li>
            <li>
              Non-toxic fragrance oils free of:
              <ul className="ml-6 mt-2 space-y-2 list-disc">
                <li>Phthalates</li>
                <li>California Prop 65 ingredients</li>
                <li>
                  Known and suspected carcinogens, mutagens, neurotoxins,
                  reproductive toxins, organ toxins, and acute toxins
                </li>
              </ul>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-4">Other info:</h2>
          <ul className="space-y-2 list-disc pl-6 text-lg">
            <li>Most candles are made using recycled jars.</li>
            <li>
              All scents are uniquely blended, and products are handmade in
              small batches in Sugar Grove, IL.
            </li>
            <li>
              Have a custom request? Contact{" "}
              <a
                href="mailto:info@slaterstreetcreative.com"
                className="text-blue-600 underline"
              >
                info@slaterstreetcreative.com
              </a>{" "}
              for inquiries.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

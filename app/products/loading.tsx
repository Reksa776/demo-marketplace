export default function LoadingProducts() {
  return (
    <main className="min-h-screen animate-pulse bg-white">

      {/* Header */}
      <div className="sticky top-0 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="h-3 w-28 rounded bg-gray-100" />
            <div className="mt-3 h-6 w-40 rounded bg-gray-200" />
          </div>

          <div className="flex gap-3">
            <div className="h-9 w-9 rounded-full bg-gray-100" />
            <div className="h-9 w-9 rounded-full bg-gray-100" />
            <div className="h-9 w-9 rounded-full bg-gray-100" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mx-auto mt-6 max-w-7xl px-5">
        <div className="h-11 rounded-xl bg-gray-100" />
      </div>

      {/* Banner */}
      <div className="mx-auto mt-6 max-w-7xl px-5">
        <div className="h-48 rounded-2xl bg-gray-100 md:h-64" />
      </div>

      {/* Category */}
      <div className="mx-auto mt-8 flex max-w-7xl gap-3 overflow-hidden px-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-10 w-24 shrink-0 rounded-lg bg-gray-100"
          />
        ))}
      </div>

      {/* Products */}
      <div className="mx-auto mt-8 max-w-7xl px-5 pb-20">
        <div className="mb-4 h-5 w-40 rounded bg-gray-200" />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-gray-200"
            >
              <div className="h-44 bg-gray-100" />

              <div className="space-y-2.5 p-4">
                <div className="h-4 rounded bg-gray-100" />

                <div className="h-4 w-3/4 rounded bg-gray-100" />

                <div className="h-3 w-1/2 rounded bg-gray-100" />

                <div className="mt-4 flex items-center justify-between">
                  <div className="h-5 w-20 rounded bg-gray-200" />

                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </main>
  );
}
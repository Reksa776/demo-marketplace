export default function ProductSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white">
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
  );
}
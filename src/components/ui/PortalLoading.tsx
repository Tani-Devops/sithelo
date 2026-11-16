// Skeleton shown by each portal's loading.tsx while a page's server data
// loads. Shaped like a typical portal page (eyebrow, heading, rows) and
// drawn on the same ivory as the shell, so the swap is quiet. The sidebar
// is not repeated here: it belongs to the page itself.
export function PortalLoading() {
  return (
    <div className="min-h-screen bg-ivory md:pl-[248px]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="px-5 sm:px-6 md:px-12 py-8 md:py-10 max-w-[1100px]" aria-hidden="true">
        <div className="skeleton h-3 w-24 mb-4" />
        <div className="skeleton h-9 w-2/3 max-w-md mb-10" />
        <div className="rule border-t">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="py-6 border-b border-line">
              <div className="skeleton h-4 w-1/2 mb-3" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

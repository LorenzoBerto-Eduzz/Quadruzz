export default function Loading() {
  return (
    <main className="site-loading" aria-live="polite" aria-busy="true">
      <span className="site-loading-spinner" aria-hidden="true" />
      <span className="visually-hidden">Loading Cross-Quadruzz</span>
    </main>
  );
}

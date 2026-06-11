// Transición de entrada en cada navegación: la app fluye, no salta.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

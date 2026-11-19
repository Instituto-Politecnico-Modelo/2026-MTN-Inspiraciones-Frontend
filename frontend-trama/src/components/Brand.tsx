export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand${compact ? ' brand-compact' : ''}`}>
    <img src="/marca/encuentro.svg" alt="" width="36" height="32" />
    {!compact && <span>trama</span>}
    {compact && <span className="sr-only">Trama</span>}
  </span>
}

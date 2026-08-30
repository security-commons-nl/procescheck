/**
 * Een review is verlopen als de datum langer dan een jaar geleden is.
 * Vergelijkt op kalenderdag (tijdstip genegeerd), zodat een review van
 * precies een jaar geleden niet in de loop van de dag "verloopt".
 */
export function isReviewExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d < cutoff
}

export const reportPage = '/admin/reportes'

export function reportLink(id?: string | null) {
  if (!id || id.length > 128) return reportPage
  try { return `${reportPage}?solicitudId=${encodeURIComponent(id)}` }
  catch { return reportPage }
}

export function isReportNotice(tipo?: string) {
  return tipo === 'REPORTE_GENERADO' || tipo === 'REPORTE_FALLIDO'
}

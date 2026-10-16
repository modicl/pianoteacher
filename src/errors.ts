const SPANISH = /[áéíóúñ¿¡]|Este PDF|No encontré|El archivo/

/** Mensaje en español para mostrar al usuario (pdf.js lanza errores en inglés). */
export function friendlyError(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'InvalidPDFException') return 'El archivo no es un PDF válido o está dañado'
    if (e.name === 'PasswordException') return 'El PDF está protegido con contraseña; quítale la contraseña y vuelve a subirlo'
    if (e.name === 'MissingPDFException') return 'No se encontró el archivo PDF'
    if (SPANISH.test(e.message)) return e.message
    return `No se pudo leer el PDF (detalle técnico: ${e.message})`
  }
  return 'No se pudo leer el PDF'
}

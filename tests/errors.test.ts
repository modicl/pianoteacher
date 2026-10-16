import { expect, test } from 'vitest'
import { friendlyError } from '../src/errors'

test('errores propios del parser ya están en español y se conservan', () => {
  expect(friendlyError(new Error('Este PDF no parece una partitura vectorial'))).toBe('Este PDF no parece una partitura vectorial')
})

test('PDF dañado de pdf.js se traduce', () => {
  const e = Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' })
  expect(friendlyError(e)).toMatch(/no es un PDF válido/)
})

test('PDF con contraseña se traduce', () => {
  const e = Object.assign(new Error('No password given'), { name: 'PasswordException' })
  expect(friendlyError(e)).toMatch(/contraseña/)
})

test('cualquier otro error en inglés se reemplaza por un mensaje genérico en español', () => {
  expect(friendlyError(new Error('Failed to fetch'))).toMatch(/No se pudo/)
  expect(friendlyError('boom')).toMatch(/No se pudo/)
})

test('un error desconocido incluye el detalle técnico para poder diagnosticarlo', () => {
  expect(friendlyError(new Error("Can't find variable: Foo"))).toContain("Can't find variable: Foo")
})

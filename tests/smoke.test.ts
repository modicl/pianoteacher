import { existsSync } from 'node:fs'
import { expect, test } from 'vitest'

test('fixture existe', () => {
  expect(existsSync('tests/fixtures/national-park.pdf')).toBe(true)
})

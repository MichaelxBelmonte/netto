import { describe, expect, it } from 'vitest'
import boundaries from '../data/italy-provinces-2026.json'

type CoordinateTree = number | CoordinateTree[]

function visitCoordinates(value: CoordinateTree, bounds: number[]) {
  if (
    Array.isArray(value) &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    bounds[0] = Math.min(bounds[0] ?? Infinity, value[0])
    bounds[1] = Math.min(bounds[1] ?? Infinity, value[1])
    bounds[2] = Math.max(bounds[2] ?? -Infinity, value[0])
    bounds[3] = Math.max(bounds[3] ?? -Infinity, value[1])
    return
  }

  if (Array.isArray(value)) {
    value.forEach((child) => visitCoordinates(child, bounds))
  }
}

describe('ISTAT 2026 map snapshot', () => {
  it('contains every provincial or metropolitan area', () => {
    expect(boundaries.features).toHaveLength(110)
    expect(new Set(boundaries.features.map((feature) => feature.properties.r))).toEqual(
      new Set(Array.from({ length: 20 }, (_, index) => index + 1)),
    )
  })

  it('contains geographic WGS84 coordinates inside the Italian extent', () => {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity]
    boundaries.features.forEach((feature) =>
      visitCoordinates(feature.geometry.coordinates as CoordinateTree, bounds),
    )

    expect(bounds[0]).toBeGreaterThan(6)
    expect(bounds[1]).toBeGreaterThan(35)
    expect(bounds[2]).toBeLessThan(19)
    expect(bounds[3]).toBeLessThan(48)
  })
})

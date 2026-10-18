import { describe, it, expect } from 'vitest'
import { niceCeil, scaleFor, xAt, yAt, indexAt, linePath, areaPath, axisLabels, tickLabel, bandPath, type Plot } from '@/ui/chartGeometry'

// A 240 × 120 chart with no margins on the right or top, 40 on the left and 20 at the bottom:
// the plotting area is 200 wide and 100 tall.
const plot: Plot = { width: 240, height: 120, left: 40, right: 0, top: 0, bottom: 20 }

describe('the chart’s maths', () => {
  it('rounds the top of the scale to a clean number', () => {
    expect([niceCeil(0), niceCeil(7), niceCeil(130), niceCeil(2_100_000), niceCeil(250)]).toEqual([0, 10, 200, 2_500_000, 250])
  })

  it('starts the scale at zero unless something goes below it', () => {
    expect(scaleFor([[10, 130, null]])).toEqual({ min: 0, max: 200, ticks: [0, 100, 200] })
    expect(scaleFor([[50], [-30]])).toEqual({ min: -50, max: 50, ticks: [-50, 0, 50] })
    expect(scaleFor([[]]).max).toBe(1)   // nothing to show still draws
  })

  it('places years and values in the plotting area', () => {
    const s = { min: 0, max: 200, ticks: [] }
    expect([xAt(0, 5, plot), xAt(4, 5, plot), xAt(2, 5, plot)]).toEqual([40, 240, 140])
    expect([yAt(0, s, plot), yAt(200, s, plot), yAt(50, s, plot)]).toEqual([100, 0, 75])
  })

  it('finds the year under a finger, clamped to the ends', () => {
    expect([indexAt(40, 5, plot), indexAt(139, 5, plot), indexAt(500, 5, plot), indexAt(0, 5, plot)]).toEqual([0, 2, 4, 0])
  })

  it('draws a line through the values and breaks it at a gap', () => {
    const s = { min: 0, max: 100, ticks: [] }
    expect(linePath([0, 100, null, 50, 50], s, plot)).toBe('M40.0 100.0 L90.0 0.0 M190.0 50.0 L240.0 50.0')
    expect(areaPath([0, 100], s, { ...plot })).toBe('M40.0 100.0 L240.0 0.0 L240.0 100.0 L40.0 100.0 Z')
  })

  it('labels the first, middle and last year', () => {
    expect(axisLabels(['2027', '2028', '2029', '2030', '2031']).map(x => x.label)).toEqual(['2027', '2029', '2031'])
    expect(axisLabels(['2027']).map(x => x.label)).toEqual(['2027'])
  })

  it('writes short axis labels', () => {
    expect([0, 250_000, 1_500_000, 50_000_000, -25_000, 999].map(tickLabel)).toEqual(['$0', '$250k', '$1.5M', '$50M', '−$25k', '$999'])
  })

  it('shades a range between two lines', () => {
    const s = { min: 0, max: 100, ticks: [] }
    // Top edge 50 → 100, back along the bottom 50 → 0.
    expect(bandPath([0, 50], [50, 100], s, plot)).toBe('M40.0 50.0 L240.0 0.0 L240.0 50.0 L40.0 100.0 Z')
    expect(bandPath([0], [1], s, plot)).toBe('')
  })
})

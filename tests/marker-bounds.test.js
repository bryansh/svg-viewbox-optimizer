const { calculateOptimization } = require('../viewbox-calculator')
const path = require('path')

describe('Marker bounds calculation', () => {
  it('should include marker bounds in optimization calculations', async () => {
    const testFile = path.join(__dirname, 'fixtures', 'test-markers.svg')

    const result = await calculateOptimization(testFile, { debug: false })

    // Verify the original viewBox
    expect(result.original.viewBox).toBe('0 0 100 100')

    // Verify content bounds are expanded to include markers
    // Without markers: would be around (10,10) to (90,90) = 80x80
    // With markers: should be expanded beyond this
    expect(result.contentBounds.width).toBeGreaterThan(80)
    expect(result.contentBounds.height).toBeGreaterThan(80)

    // Verify specific bounds include marker extensions
    // The line goes from (10,10) to (90,90) with arrowhead marker
    // Arrowhead should extend bounds beyond x=90
    expect(result.contentBounds.x + result.contentBounds.width).toBeGreaterThan(90)

    // Verify elements were found
    expect(result.elements.count).toBe(3) // line, path, polyline
  })

  it('should handle elements without markers normally', async () => {
    const testFile = path.join(__dirname, 'fixtures', 'simple-rect.svg')

    const result = await calculateOptimization(testFile, { debug: false })

    // Simple rect should not have expanded bounds
    expect(result.contentBounds.x).toBe(50)
    expect(result.contentBounds.y).toBe(50)
    expect(result.contentBounds.width).toBe(100)
    expect(result.contentBounds.height).toBe(100)

    expect(result.elements.count).toBe(1)
  })
})

const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Performance and Timing Tests', () => {
  let tempFiles = []

  afterEach(() => {
    // Clean up temporary files
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    })
    tempFiles = []
  })

  const createTempFile = (content) => {
    const tempFile = path.join(__dirname, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`)
    fs.writeFileSync(tempFile, content)
    tempFiles.push(tempFile)
    return tempFile
  }

  // Skip performance tests in CI environments
  const describeOrSkip = process.env.CI ? describe.skip : describe

  describeOrSkip('Script delay timing validation', () => {
    it('should respect long script delays accurately', async () => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
</svg>`

      const tempFile = createTempFile(svg)

      // Test with a long delay (3 seconds) - only in non-CI environments
      const delay = 3000
      const startTime = Date.now()
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: delay
      })
      const duration = Date.now() - startTime

      expect(result.elements.count).toBe(1)
      expect(duration).toBeGreaterThanOrEqual(delay)
      expect(duration).toBeLessThan(delay + 2000) // Allow 2s overhead
    })

    it('should handle medium delays consistently', async () => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
</svg>`

      const tempFile = createTempFile(svg)

      // Test multiple runs for consistency
      const delay = 1000
      const results = []

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now()
        await calculateOptimization(tempFile, {
          buffer: 10,
          scriptDelay: delay
        })
        const duration = Date.now() - startTime
        results.push(duration)
      }

      // All runs should be reasonably close to the expected delay
      results.forEach(duration => {
        expect(duration).toBeGreaterThanOrEqual(delay)
        expect(duration).toBeLessThan(delay + 1000)
      })

      // Standard deviation should be reasonable (less than 200ms)
      const avg = results.reduce((a, b) => a + b) / results.length
      const variance = results.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / results.length
      const stdDev = Math.sqrt(variance)
      expect(stdDev).toBeLessThan(200)
    })
  })

  describeOrSkip('Performance benchmarks', () => {
    it('should process simple SVGs quickly', async () => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
</svg>`

      const tempFile = createTempFile(svg)

      const startTime = Date.now()
      await calculateOptimization(tempFile, { buffer: 10 })
      const duration = Date.now() - startTime

      // Simple SVG should process in under 2 seconds
      expect(duration).toBeLessThan(2000)
    })

    it('should handle complex SVGs within reasonable time', async () => {
      const complexSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  ${Array.from({ length: 100 }, (_, i) =>
    `<rect x="${i * 10}" y="${i * 5}" width="50" height="30" fill="hsl(${i * 3.6}, 70%, 50%)"/>`
  ).join('\n  ')}
  <g transform="translate(500, 500)">
    ${Array.from({ length: 50 }, (_, i) =>
      `<circle cx="${Math.cos(i * 0.1) * 100}" cy="${Math.sin(i * 0.1) * 100}" r="20" fill="blue"/>`
    ).join('\n    ')}
  </g>
</svg>`

      const tempFile = createTempFile(complexSvg)

      const startTime = Date.now()
      const result = await calculateOptimization(tempFile, { buffer: 10 })
      const duration = Date.now() - startTime

      // Complex SVG should still process in reasonable time
      expect(duration).toBeLessThan(10000) // 10 seconds max
      expect(result.elements.count).toBeGreaterThan(140) // Should find all elements
    })
  })
})

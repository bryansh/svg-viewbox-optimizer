const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SVG Optimization', () => {
  const fixturesDir = path.join(__dirname, 'fixtures')

  describe('ViewBox calculations', () => {
    it('should optimize simple rectangle correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Simple rect at x=50, y=50, width=100, height=100
      // With 10px buffer: x=40, y=40, width=120, height=120
      expect(result.original.viewBox).toBe('0 0 200 200')
      expect(result.optimized.viewBox).toBe('40.00 40.00 120.00 120.00')
      expect(result.content.width).toBeCloseTo(100, 1)
      expect(result.content.height).toBeCloseTo(100, 1)
      expect(result.optimized.width).toBeCloseTo(120, 1)
      expect(result.optimized.height).toBeCloseTo(120, 1)
    })

    it('should handle animated elements correctly', async () => {
      const input = path.join(fixturesDir, 'animated-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Animated rect moves from x=50 to x=150 (50 + 100 translation)
      // So bounds should be x=50 to x=200 (150 + 50 width)
      // With 10px buffer: x=40, width=170, height=70 (rect is 50x50)
      expect(result.original.viewBox).toBe('0 0 300 300')
      expect(result.optimized.viewBox).toBe('40.00 40.00 170.00 70.00')
      expect(result.elements.animationCount).toBeGreaterThan(0)
    })

    it('should handle symbol/use patterns', async () => {
      const input = path.join(fixturesDir, 'symbol-use.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Use element at x=150, y=150 with 100x100 size
      // The star polygon within the symbol is offset by (10,10) and is 80x80
      // So final rendered bounds are (160,160) with 80x80 size
      // With 10px buffer: viewBox becomes (150,150) with 100x100 size
      expect(result.original.viewBox).toBe('0 0 400 400')
      expect(result.optimized.viewBox).toBe('150.00 150.00 100.00 100.00')
      expect(result.content.width).toBeCloseTo(80, 1)
      expect(result.content.height).toBeCloseTo(80, 1)
      expect(result.optimized.width).toBeCloseTo(100, 1)
      expect(result.optimized.height).toBeCloseTo(100, 1)
    })
  })

  describe('Space savings calculations', () => {
    it('should calculate space savings correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Original: 200x200 = 40,000 units²
      // New: 120x120 = 14,400 units²
      // Savings: (40,000 - 14,400) / 40,000 = 64%
      expect(result.original.area).toBe(40000)
      expect(result.optimized.area).toBe(14400)
      expect(result.savings.percentage).toBeCloseTo(64, 1)
      expect(result.savings.unitsSquared).toBe(25600)
    })

    it('should show significant savings for large empty areas', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      expect(result.savings.percentage).toBeGreaterThan(50) // Should save significant space
    })
  })

  describe('Buffer handling', () => {
    it('should apply buffer correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')

      // Test with 0 buffer
      const result0 = await calculateOptimization(input, { buffer: 0 })
      expect(result0.optimized.viewBox).toBe('50.00 50.00 100.00 100.00')
      expect(result0.buffer).toBe(0)

      // Test with 20 buffer
      const result20 = await calculateOptimization(input, { buffer: 20 })
      expect(result20.optimized.viewBox).toBe('30.00 30.00 140.00 140.00')
      expect(result20.buffer).toBe(20)
    })

    it('should handle negative coordinates with buffer', async () => {
      // Create a test SVG with element at origin
      const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50" fill="red" />
      </svg>`

      const tempFile = path.join(__dirname, 'temp-test.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.optimized.viewBox).toBe('-10.00 -10.00 70.00 70.00')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle complex weather icon', async () => {
      const weatherIcon = path.join(__dirname, '..', 'thunderstorms-overcast.svg')

      if (fs.existsSync(weatherIcon)) {
        const result = await calculateOptimization(weatherIcon, { buffer: 10 })

        expect(result.original.viewBox).toBe('0 0 512 512')
        expect(result.optimized.viewBox).toBe('43.54 138.08 441.66 340.82')
        expect(result.elements.count).toBe(3)
        expect(result.elements.animationCount).toBe(2)
        expect(result.savings.percentage).toBeCloseTo(42.6, 1)
      }
    })

    it('should handle test animations', async () => {
      const testAnimations = path.join(__dirname, '..', 'test-animations.svg')

      if (fs.existsSync(testAnimations)) {
        const result = await calculateOptimization(testAnimations, { buffer: 10 })

        expect(result.original.viewBox).toBe('0 0 400 400')
        expect(result.elements.count).toBe(7)
        expect(result.elements.animationCount).toBeGreaterThan(0)
      }
    })
  })
})

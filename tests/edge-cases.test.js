const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Edge Cases and Error Handling', () => {
  const fixturesDir = path.join(__dirname, 'fixtures')

  describe('Invalid SVG files', () => {
    it('should handle malformed SVG', async () => {
      const malformedSvg = '<svg viewBox="0 0 100 100"><rect x="invalid" y="10" width="50" height="50"/></svg>'
      const tempFile = path.join(__dirname, 'malformed.svg')
      fs.writeFileSync(tempFile, malformedSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        // Should not crash, treats invalid x as 0
        expect(result.elements.count).toBeGreaterThanOrEqual(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle SVG with no visual elements', async () => {
      const emptyInput = path.join(fixturesDir, 'empty.svg')
      const result = await calculateOptimization(emptyInput, { buffer: 10 })

      expect(result.elements.count).toBe(0)
      expect(result.elements.animationCount).toBe(0)
      expect(result.content.width).toBe(0)
      expect(result.content.height).toBe(0)
    })

    it('should handle SVG without viewBox', async () => {
      const noViewboxInput = path.join(fixturesDir, 'no-viewbox.svg')

      await expect(calculateOptimization(noViewboxInput, { buffer: 10 })).rejects.toThrow()
    })

    it('should handle completely invalid file', async () => {
      const invalidFile = path.join(__dirname, 'invalid.txt')
      fs.writeFileSync(invalidFile, 'This is not an SVG file')

      try {
        await expect(calculateOptimization(invalidFile, { buffer: 10 })).rejects.toThrow()
      } finally {
        fs.unlinkSync(invalidFile)
      }
    })
  })

  describe('Boundary conditions', () => {
    it('should handle very large viewBox values', async () => {
      const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10000 10000">
        <rect x="5000" y="5000" width="100" height="100" fill="red" />
      </svg>`

      const tempFile = path.join(__dirname, 'large.svg')
      fs.writeFileSync(tempFile, largeSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.original.viewBox).toBe('0 0 10000 10000')
        expect(result.optimized.viewBox).toBe('4990.00 4990.00 120.00 120.00')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle negative coordinates', async () => {
      const negativeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-500 -500 1000 1000">
        <rect x="-50" y="-50" width="100" height="100" fill="red" />
      </svg>`

      const tempFile = path.join(__dirname, 'negative.svg')
      fs.writeFileSync(tempFile, negativeSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.original.viewBox).toBe('-500 -500 1000 1000')
        expect(result.optimized.viewBox).toBe('-60.00 -60.00 120.00 120.00')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle very small elements', async () => {
      const smallSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <rect x="500" y="500" width="1" height="1" fill="red" />
      </svg>`

      const tempFile = path.join(__dirname, 'small.svg')
      fs.writeFileSync(tempFile, smallSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.original.viewBox).toBe('0 0 1000 1000')
        expect(result.optimized.viewBox).toBe('490.00 490.00 21.00 21.00')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex SVG structures', () => {
    it('should handle nested groups', async () => {
      const nestedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <g transform="translate(50, 50)">
          <g transform="translate(25, 25)">
            <rect x="0" y="0" width="50" height="50" fill="red" />
          </g>
        </g>
      </svg>`

      const tempFile = path.join(__dirname, 'nested.svg')
      fs.writeFileSync(tempFile, nestedSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        // getBBox() handles nested transforms automatically
        expect(result.elements.count).toBe(3) // g, g, rect
        expect(result.content.width).toBeCloseTo(75, 1)
        expect(result.content.height).toBeCloseTo(75, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle mixed element types', async () => {
      const mixedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect x="50" y="50" width="50" height="50" fill="red" />
        <circle cx="200" cy="200" r="25" fill="blue" />
        <ellipse cx="150" cy="100" rx="30" ry="20" fill="green" />
      </svg>`

      const tempFile = path.join(__dirname, 'mixed.svg')
      fs.writeFileSync(tempFile, mixedSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.elements.count).toBe(3)
        // Should encompass all elements: rect(50-100, 50-100), circle(175-225, 175-225), ellipse(120-180, 80-120)
        // Content dimensions should cover from x=50 to x=225 (175 wide) and y=50 to y=225 (175 tall)
        expect(result.content.width).toBeCloseTo(175, 1)
        expect(result.content.height).toBeCloseTo(175, 1)
        expect(result.optimized.width).toBeCloseTo(195, 1)
        expect(result.optimized.height).toBeCloseTo(195, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle elements with zero dimensions', async () => {
      const zeroDimSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <rect x="50" y="50" width="0" height="50" fill="red" />
        <rect x="100" y="100" width="50" height="50" fill="blue" />
      </svg>`

      const tempFile = path.join(__dirname, 'zero-dim.svg')
      fs.writeFileSync(tempFile, zeroDimSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        // Should only find the valid rect (zero-width rect should be ignored)
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Animation edge cases', () => {
    it('should handle animation with malformed values', async () => {
      const malformedAnim = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <rect x="50" y="50" width="50" height="50" fill="red">
          <animateTransform
            attributeName="transform"
            type="translate"
            values="invalid; 50 0; 0 0"
            dur="2s"
            repeatCount="indefinite"/>
        </rect>
      </svg>`

      const tempFile = path.join(__dirname, 'malformed-anim.svg')
      fs.writeFileSync(tempFile, malformedAnim)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        // Should not crash, might treat as static element
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animations with no values', async () => {
      const noValueAnim = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
        <rect x="50" y="50" width="50" height="50" fill="red">
          <animateTransform
            attributeName="transform"
            type="translate"
            dur="2s"
            repeatCount="indefinite"/>
        </rect>
      </svg>`

      const tempFile = path.join(__dirname, 'no-value-anim.svg')
      fs.writeFileSync(tempFile, noValueAnim)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

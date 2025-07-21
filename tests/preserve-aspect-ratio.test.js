const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('preserveAspectRatio Support', () => {
  describe('Basic preserveAspectRatio functionality', () => {
    it('should handle preserveAspectRatio="xMidYMid meet" (default behavior)', async () => {
      // Viewport is 100x80, viewBox is 50x50 (square in rectangle)
      // With "meet", content should be centered and scaled to fit entirely
      // Scale factor = min(100/50, 80/50) = min(2, 1.6) = 1.6
      // Scaled size = 50 * 1.6 = 80x80, positioned at (10, 0) to center horizontally
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="40" height="30" fill="blue"/>
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 50" preserveAspectRatio="xMidYMid meet">
    <rect x="10" y="10" width="30" height="30" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-meet.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Expected bounds:
        // Outer rect: (50,50) to (90,80)
        // Nested rect with preserveAspectRatio:
        //   - Original in viewBox: (10,10) to (40,40)
        //   - Scale factor: min(100/50, 80/50) = 1.6
        //   - Scaled size: 80x80, centered in 100x80 viewport at offset (10,0)
        //   - Final position: x=100+10+10*1.6=126, y=100+0+10*1.6=116, size=30*1.6=48
        //   - Bounds: (126,116) to (174,164)
        expect(result.content.minX).toBeCloseTo(50, 1)
        expect(result.content.minY).toBeCloseTo(50, 1)
        expect(result.content.maxX).toBeCloseTo(174, 1)
        expect(result.content.maxY).toBeCloseTo(164, 1)
        expect(result.elements.count).toBe(2)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle preserveAspectRatio="xMidYMid slice"', async () => {
      // With "slice", content should be scaled to fill entire viewport
      // Scale factor = max(100/50, 80/50) = max(2, 1.6) = 2
      // Scaled size = 50 * 2 = 100x100, with 20px clipped vertically
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="40" height="30" fill="blue"/>
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 50" preserveAspectRatio="xMidYMid slice">
    <rect x="10" y="10" width="30" height="30" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-slice.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Expected bounds with slice:
        // Scale factor: max(100/50, 80/50) = 2
        // Viewport offset: (0, -10) to center vertically
        // Nested rect: (10,10) to (40,40) scaled by 2 = (20,20) to (80,80)
        // Positioned at (100,100) with offset (0,-10) = (120,110) to (180,170)
        expect(result.content.minX).toBeCloseTo(50, 1)
        expect(result.content.minY).toBeCloseTo(50, 1)
        expect(result.content.maxX).toBeCloseTo(180, 1)
        expect(result.content.maxY).toBeCloseTo(170, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle preserveAspectRatio="none" (non-uniform scaling)', async () => {
      // With "none", content should be stretched to fill viewport non-uniformly
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="40" height="30" fill="blue"/>
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 50" preserveAspectRatio="none">
    <rect x="10" y="10" width="30" height="30" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-none.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Expected bounds with non-uniform scaling:
        // Scale factors: scaleX = 100/50 = 2, scaleY = 80/50 = 1.6
        // Nested rect: (10,10) to (40,40) scaled = (20,16) to (80,64)
        // Positioned at (100,100) = (120,116) to (180,164)
        expect(result.content.minX).toBeCloseTo(50, 1)
        expect(result.content.minY).toBeCloseTo(50, 1)
        expect(result.content.maxX).toBeCloseTo(180, 1)
        expect(result.content.maxY).toBeCloseTo(164, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Alignment variations with meet', () => {
    const alignmentTests = [
      {
        align: 'xMinYMin',
        description: 'top-left alignment',
        expectedOffset: { x: 0, y: 0 }
      },
      {
        align: 'xMidYMin',
        description: 'top-center alignment',
        expectedOffset: { x: 10, y: 0 }
      },
      {
        align: 'xMaxYMin',
        description: 'top-right alignment',
        expectedOffset: { x: 20, y: 0 }
      },
      {
        align: 'xMinYMid',
        description: 'middle-left alignment',
        expectedOffset: { x: 0, y: 0 }
      },
      {
        align: 'xMidYMid',
        description: 'center alignment (default)',
        expectedOffset: { x: 10, y: 0 }
      },
      {
        align: 'xMaxYMid',
        description: 'middle-right alignment',
        expectedOffset: { x: 20, y: 0 }
      },
      {
        align: 'xMinYMax',
        description: 'bottom-left alignment',
        expectedOffset: { x: 0, y: 0 }
      },
      {
        align: 'xMidYMax',
        description: 'bottom-center alignment',
        expectedOffset: { x: 10, y: 0 }
      },
      {
        align: 'xMaxYMax',
        description: 'bottom-right alignment',
        expectedOffset: { x: 20, y: 0 }
      }
    ]

    alignmentTests.forEach(({ align, description, expectedOffset }) => {
      it(`should handle preserveAspectRatio="${align} meet" (${description})`, async () => {
        // Viewport 100x80, viewBox 50x50, scale factor 1.6, leaves 20px horizontal space
        const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 50" preserveAspectRatio="${align} meet">
    <rect x="20" y="20" width="10" height="10" fill="red"/>
  </svg>
</svg>`

        const tempFile = path.join(__dirname, `temp-aspect-ratio-${align.toLowerCase()}.svg`)
        fs.writeFileSync(tempFile, testSvg)

        try {
          const result = await calculateOptimization(tempFile, { buffer: 5 })

          // Scale factor = min(100/50, 80/50) = 1.6
          // Rect bounds in viewBox: (20,20) to (30,30)
          // Scaled: (32,32) to (48,48)
          // With alignment offset and positioned at (100,100):
          const expectedX = 100 + expectedOffset.x + 20 * 1.6
          const expectedY = 100 + expectedOffset.y + 20 * 1.6

          expect(result.content.minX).toBeCloseTo(expectedX, 1)
          expect(result.content.minY).toBeCloseTo(expectedY, 1)
          expect(result.content.maxX).toBeCloseTo(expectedX + 16, 1) // 10 * 1.6 = 16
          expect(result.content.maxY).toBeCloseTo(expectedY + 16, 1)
        } finally {
          fs.unlinkSync(tempFile)
        }
      })
    })
  })

  describe('Alignment variations with slice', () => {
    it('should handle preserveAspectRatio="xMinYMid slice" with clipping', async () => {
      // When viewport is wider than viewBox aspect ratio, slice clips vertically
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="120" height="60" viewBox="0 0 40 40" preserveAspectRatio="xMinYMid slice">
    <rect x="10" y="10" width="20" height="20" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-slice-clip.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Scale factor = max(120/40, 60/40) = max(3, 1.5) = 3
        // Scaled viewBox: 40*3 = 120x120, but viewport is 120x60
        // Vertical clipping: (120-60)/2 = 30px clipped top and bottom
        // Content offset: (0, -30)
        // Rect bounds: (10,10) to (30,30) scaled by 3 = (30,30) to (90,90)
        // With clipping offset: (30,0) to (90,60)
        // Positioned at (100,100): (130,100) to (190,160)
        expect(result.content.minX).toBeCloseTo(130, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(190, 1)
        expect(result.content.maxY).toBeCloseTo(160, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple nested SVGs with different preserveAspectRatio values', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="50" y="50" width="80" height="60" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
    <rect x="10" y="10" width="20" height="20" fill="red"/>
  </svg>
  <svg x="150" y="50" width="80" height="60" viewBox="0 0 40 40" preserveAspectRatio="none">
    <rect x="10" y="10" width="20" height="20" fill="blue"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-multiple.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // First nested SVG (meet): scale = min(80/40, 60/40) = 1.5, centered with 10px offset
        // Rect (10,10)-(30,30) -> scaled (15,15)-(45,45) -> offset (25,15)-(55,45) -> positioned (75,65)-(105,95)
        // Second nested SVG (none): scaleX = 80/40 = 2, scaleY = 60/40 = 1.5
        // Rect (10,10)-(30,30) -> scaled (20,15)-(60,45) -> positioned (170,65)-(210,95)
        expect(result.elements.count).toBe(2)
        expect(result.content.minX).toBeCloseTo(75, 1) // First rect starts at 75
        expect(result.content.maxX).toBeCloseTo(210, 1) // Second rect ends at 210
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle preserveAspectRatio with transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="80" height="60" viewBox="0 0 40 40" 
       preserveAspectRatio="xMidYMid meet" transform="rotate(45)">
    <rect x="15" y="15" width="10" height="10" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-transform.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should handle both preserveAspectRatio scaling and rotation transform
        expect(result.elements.count).toBe(1)
        // Rect is small (10x10 scaled by 1.5 = 15x15) but rotation may expand bounds slightly
        expect(result.content.maxX - result.content.minX).toBeGreaterThan(10)
        expect(result.content.maxY - result.content.minY).toBeGreaterThan(10)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle missing preserveAspectRatio (defaults to xMidYMid meet)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 50">
    <rect x="20" y="20" width="10" height="10" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-default.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Should behave exactly like "xMidYMid meet"
        // Scale factor = min(100/50, 80/50) = 1.6
        const expectedX = 100 + 10 + 20 * 1.6 // 10px offset for centering + scaled position
        const expectedY = 100 + 0 + 20 * 1.6 // No Y offset needed

        expect(result.content.minX).toBeCloseTo(expectedX, 1)
        expect(result.content.minY).toBeCloseTo(expectedY, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle preserveAspectRatio with zero dimensions', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="0" height="80" viewBox="0 0 50 50" preserveAspectRatio="xMidYMid meet">
    <rect x="20" y="20" width="10" height="10" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-zero-width.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Should handle gracefully - with zero width, the element is processed but contributes no bounds
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle preserveAspectRatio with zero viewBox dimensions', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="80" height="60" viewBox="0 0 0 50" preserveAspectRatio="xMidYMid meet">
    <rect x="20" y="20" width="10" height="10" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-aspect-ratio-zero-viewbox.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 5 })

        // Should handle gracefully - with zero viewBox width, fallback behavior is used
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Pattern Overflow Support', () => {
  describe('Basic pattern overflow detection', () => {
    it('should expand bounds for patterns with visual overflow', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="overflowPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <!-- Circle extends 10px beyond pattern tile -->
      <circle cx="10" cy="10" r="20" fill="red"/>
    </pattern>
  </defs>
  <rect x="100" y="100" width="50" height="50" fill="url(#overflowPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-overflow.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Pattern extends 10px beyond tile on all sides
        // Rectangle at (100,100) size 50x50 should expand to (90,90) size 70x70
        expect(result.content.minX).toBeCloseTo(90, 1)
        expect(result.content.minY).toBeCloseTo(90, 1)
        expect(result.content.maxX).toBeCloseTo(160, 1)
        expect(result.content.maxY).toBeCloseTo(160, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should not expand bounds for patterns without overflow', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="containedPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <!-- Small circle contained within pattern tile -->
      <circle cx="10" cy="10" r="5" fill="blue"/>
    </pattern>
  </defs>
  <rect x="100" y="100" width="50" height="50" fill="url(#containedPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-contained.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // No overflow, bounds should match geometry
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle asymmetric pattern overflow', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="asymmetricPattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
      <!-- Rectangle extends beyond pattern on right and bottom -->
      <rect x="10" y="10" width="40" height="35" fill="green"/>
    </pattern>
  </defs>
  <rect x="100" y="100" width="60" height="60" fill="url(#asymmetricPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-asymmetric.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Pattern extends 20px right and 15px bottom beyond tile
        // Rectangle stays at (100,100) but extends to (180,175)
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(180, 1)
        expect(result.content.maxY).toBeCloseTo(175, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle complex pattern content with multiple elements', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="complexPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <!-- Multiple elements with different overflows -->
      <circle cx="20" cy="20" r="25" fill="red" opacity="0.5"/>
      <rect x="-5" y="15" width="20" height="20" fill="blue" opacity="0.5"/>
      <path d="M 30,30 L 50,50" stroke="green" stroke-width="2"/>
    </pattern>
  </defs>
  <rect x="100" y="100" width="80" height="80" fill="url(#complexPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-complex.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Pattern has various overflows:
        // - Circle extends 5px on all sides
        // - Rectangle extends 5px left
        // - Path extends 10px right and bottom
        expect(result.content.minX).toBeCloseTo(95, 1)  // 100 - 5
        expect(result.content.minY).toBeCloseTo(95, 1)  // 100 - 5
        expect(result.content.maxX).toBeCloseTo(190, 1) // 180 + 10
        expect(result.content.maxY).toBeCloseTo(190, 1) // 180 + 10
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle pattern on transformed elements', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="overflowPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="15" fill="red"/>
    </pattern>
  </defs>
  <!-- Rotated rectangle with pattern -->
  <rect x="100" y="100" width="50" height="50" fill="url(#overflowPattern)" 
        transform="rotate(45 125 125)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-transform.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // The pattern overflow should be considered even with transforms
        // This is a complex case - the bounds should account for both
        // the rotation and the pattern overflow
        expect(result.content.minX).toBeLessThan(100)
        expect(result.content.minY).toBeLessThan(100)
        expect(result.content.maxX).toBeGreaterThan(150)
        expect(result.content.maxY).toBeGreaterThan(150)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle patterns with no content', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="emptyPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <!-- Empty pattern -->
    </pattern>
  </defs>
  <rect x="100" y="100" width="50" height="50" fill="url(#emptyPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-empty.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Empty pattern should not affect bounds
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle non-existent pattern references', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="50" height="50" fill="url(#nonExistentPattern)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-pattern-missing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Missing pattern should not affect bounds
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})
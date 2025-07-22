const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SVG Switch Element Support', () => {
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

  describe('Basic switch functionality', () => {
    it('should select first compatible child from switch element', async () => {
      const switchSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <switch>
    <rect x="50" y="50" width="100" height="100" fill="red" 
          requiredFeatures="http://www.w3.org/TR/SVG11/feature#SVG"/>
    <rect x="100" y="100" width="50" height="50" fill="blue"/>
  </switch>
</svg>`

      const tempFile = createTempFile(switchSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should select the first rect (red) since SVG feature is supported
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(100, 1) // First rect dimensions
      expect(result.content.height).toBeCloseTo(100, 1)
    })

    it('should fallback to compatible child when first has unsupported features', async () => {
      const switchSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <switch>
    <rect x="50" y="50" width="100" height="100" fill="red" 
          requiredFeatures="http://example.com/unsupported-feature"/>
    <rect x="100" y="100" width="80" height="80" fill="blue"/>
  </switch>
</svg>`

      const tempFile = createTempFile(switchSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should fallback to second rect (blue) since first has unsupported feature
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(80, 1) // Second rect dimensions
      expect(result.content.height).toBeCloseTo(80, 1)
    })

    it('should handle switch with requiredExtensions', async () => {
      const switchSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <switch>
    <rect x="50" y="50" width="100" height="100" fill="red" 
          requiredExtensions="http://example.com/some-extension"/>
    <circle cx="200" cy="200" r="40" fill="green"/>
  </switch>
</svg>`

      const tempFile = createTempFile(switchSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should select circle since extensions are typically not supported
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(80, 1) // Circle diameter
      expect(result.content.height).toBeCloseTo(80, 1)
    })
  })

  describe('Multiple switch elements', () => {
    it('should handle multiple switch elements', async () => {
      const switchSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <switch>
    <rect x="50" y="50" width="100" height="100" fill="red" 
          requiredFeatures="http://www.w3.org/TR/SVG11/feature#SVG"/>
    <rect x="50" y="50" width="80" height="80" fill="blue"/>
  </switch>
  <switch>
    <circle cx="300" cy="300" r="50" fill="green" 
            requiredFeatures="http://example.com/unsupported"/>
    <circle cx="300" cy="300" r="40" fill="yellow"/>
  </switch>
</svg>`

      const tempFile = createTempFile(switchSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should select first rect (SVG supported) and second circle (fallback)
      expect(result.elements.count).toBe(2)
    })
  })

  describe('Mixed content with switch elements', () => {
    it('should handle mix of switch and regular elements', async () => {
      const mixedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect x="10" y="10" width="50" height="50" fill="purple"/>
  <switch>
    <rect x="100" y="100" width="100" height="100" fill="red" 
          requiredFeatures="http://www.w3.org/TR/SVG11/feature#SVG"/>
    <rect x="100" y="100" width="80" height="80" fill="blue"/>
  </switch>
  <circle cx="350" cy="350" r="30" fill="orange"/>
</svg>`

      const tempFile = createTempFile(mixedSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should include regular rect, switch-selected rect, and regular circle
      expect(result.elements.count).toBe(3)
    })
  })

  describe('Nested switch elements', () => {
    it('should handle nested switch elements', async () => {
      const nestedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <switch>
    <g requiredFeatures="http://example.com/unsupported">
      <rect x="50" y="50" width="100" height="100" fill="red"/>
    </g>
    <switch>
      <rect x="100" y="100" width="80" height="80" fill="blue" 
            requiredFeatures="http://www.w3.org/TR/SVG11/feature#SVG"/>
      <rect x="120" y="120" width="60" height="60" fill="green"/>
    </switch>
  </switch>
</svg>`

      const tempFile = createTempFile(nestedSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should select the inner switch, then the blue rect from that switch
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(80, 1)
      expect(result.content.height).toBeCloseTo(80, 1)
    })
  })

  describe('Switch with no valid children', () => {
    it('should handle switch where no children meet requirements', async () => {
      const noValidSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect x="10" y="10" width="50" height="50" fill="purple"/>
  <switch>
    <rect x="100" y="100" width="100" height="100" fill="red" 
          requiredFeatures="http://example.com/unsupported-1"/>
    <rect x="150" y="150" width="80" height="80" fill="blue"
          requiredFeatures="http://example.com/unsupported-2"/>
  </switch>
</svg>`

      const tempFile = createTempFile(noValidSvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should only include the regular rect, not any switch children
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(50, 1)
      expect(result.content.height).toBeCloseTo(50, 1)
    })
  })
})
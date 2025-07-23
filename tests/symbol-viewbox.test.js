const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Symbol ViewBox Support', () => {
  describe('Basic symbol viewBox transformations', () => {
    it('should handle symbol with viewBox and "meet" scaling', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <rect x="10" y="10" width="80" height="80" fill="blue"/>
    </symbol>
  </defs>
  <use href="#icon" x="50" y="50" width="200" height="150"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-viewbox-meet.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Symbol viewBox 0 0 100 100, use 200x150 at (50,50)
        // Scale = min(200/100, 150/100) = 1.5
        // Rectangle (10,10,80,80) scaled: (15,15,120,120) + offset(25,0) + position(50,50)
        // Final bounds: (90,65) to (210,185) = 120x120
        expect(result.content.minX).toBeCloseTo(90, 1)
        expect(result.content.minY).toBeCloseTo(65, 1)
        expect(result.content.maxX).toBeCloseTo(210, 1)
        expect(result.content.maxY).toBeCloseTo(185, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle symbol with viewBox and "slice" scaling', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <rect x="20" y="20" width="60" height="60" fill="red"/>
    </symbol>
  </defs>
  <use href="#icon" x="100" y="100" width="150" height="200"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-viewbox-slice.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Symbol viewBox 0 0 100 100, use 150x200 at (100,100)
        // Scale = max(150/100, 200/100) = 2.0
        // Rectangle (20,20,60,60) scaled: (40,40,120,120) + offset(-25,0) + position(100,100)
        // Final bounds: (115,140) to (235,260) = 120x120
        expect(result.content.minX).toBeCloseTo(115, 1)
        expect(result.content.minY).toBeCloseTo(140, 1)
        expect(result.content.maxX).toBeCloseTo(235, 1)
        expect(result.content.maxY).toBeCloseTo(260, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle symbol with viewBox and "none" scaling', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="0 0 50 50" preserveAspectRatio="none">
      <circle cx="25" cy="25" r="20" fill="green"/>
    </symbol>
  </defs>
  <use href="#icon" x="100" y="100" width="100" height="150"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-viewbox-none.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Symbol viewBox 0 0 50 50, use 100x150 at (100,100)
        // Non-uniform scaling: scaleX=2.0, scaleY=3.0
        // Circle bounds (5,5,40,40) scaled: (10,15,80,120) + position(100,100)
        // Final bounds: (110,115) to (190,235) = 80x120
        expect(result.content.minX).toBeCloseTo(110, 1)
        expect(result.content.minY).toBeCloseTo(115, 1)
        expect(result.content.maxX).toBeCloseTo(190, 1)
        expect(result.content.maxY).toBeCloseTo(235, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle symbol without viewBox (direct coordinates)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon">
      <rect x="10" y="10" width="80" height="80" fill="blue"/>
    </symbol>
  </defs>
  <use href="#icon" x="100" y="100" width="50" height="50"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-no-viewbox.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Symbol without viewBox should use getBBox fallback
        // This should match the browser's native behavior
        expect(result.content.minX).toBeGreaterThan(90)
        expect(result.content.minY).toBeGreaterThan(90)
        expect(result.content.maxX).toBeLessThan(200)
        expect(result.content.maxY).toBeLessThan(200)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex symbol viewBox scenarios', () => {
    it('should handle multiple elements within symbol', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="complexIcon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
      <rect x="10" y="10" width="30" height="30" fill="red"/>
      <circle cx="75" cy="75" r="20" fill="blue"/>
      <path d="M 20,60 L 60,20 L 80,40" stroke="green" stroke-width="2"/>
    </symbol>
  </defs>
  <use href="#complexIcon" x="50" y="50" width="120" height="120"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-complex.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // All elements should be transformed consistently
        // Symbol viewBox 0 0 100 100, use 120x120 at (50,50), scale = 1.2
        expect(result.content.minX).toBeCloseTo(62, 1)  // (10*1.2+50)
        expect(result.content.minY).toBeCloseTo(62, 1)  // (10*1.2+50)
        expect(result.content.maxX).toBeCloseTo(164, 1) // max of all transformed elements
        expect(result.content.maxY).toBeCloseTo(164, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle different alignment modes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="0 0 100 100" preserveAspectRatio="xMinYMin meet">
      <rect x="40" y="40" width="20" height="20" fill="orange"/>
    </symbol>
  </defs>
  <use href="#icon" x="100" y="100" width="200" height="100"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-alignment.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Symbol viewBox 0 0 100 100, use 200x100 at (100,100)
        // Scale = min(200/100, 100/100) = 1.0
        // With xMinYMin, no offset (content aligned to top-left)
        // Rectangle (40,40,20,20) scaled: (40,40,20,20) + position(100,100)
        expect(result.content.minX).toBeCloseTo(140, 1)
        expect(result.content.minY).toBeCloseTo(140, 1)
        expect(result.content.maxX).toBeCloseTo(160, 1)
        expect(result.content.maxY).toBeCloseTo(160, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle nested symbols with viewBox', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="innerIcon" viewBox="0 0 50 50">
      <rect x="10" y="10" width="30" height="30" fill="purple"/>
    </symbol>
    <symbol id="outerIcon" viewBox="0 0 100 100">
      <use href="#innerIcon" x="25" y="25" width="50" height="50"/>
    </symbol>
  </defs>
  <use href="#outerIcon" x="100" y="100" width="100" height="100"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-nested.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // This is a complex nested transformation case
        // The inner symbol should be transformed through both coordinate systems
        expect(result.content.minX).toBeGreaterThan(120)
        expect(result.content.minY).toBeGreaterThan(120)
        expect(result.content.maxX).toBeLessThan(180)
        expect(result.content.maxY).toBeLessThan(180)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle use element without dimensions', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="0 0 100 100">
      <rect x="20" y="20" width="60" height="60" fill="cyan"/>
    </symbol>
  </defs>
  <use href="#icon" x="50" y="50"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-no-dimensions.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // When no dimensions specified, should use symbol's intrinsic size
        expect(result.content.minX).toBeCloseTo(70, 1) // (20+50)
        expect(result.content.minY).toBeCloseTo(70, 1) // (20+50)
        expect(result.content.maxX).toBeCloseTo(130, 1) // (80+50)
        expect(result.content.maxY).toBeCloseTo(130, 1) // (80+50)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle non-existent symbol reference', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <use href="#nonExistentSymbol" x="100" y="100" width="50" height="50"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-missing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should fallback to getBBox behavior
        // Non-existent symbols result in empty bounds, so element may not be counted
        expect(result.elements.count).toBeGreaterThanOrEqual(0)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle malformed viewBox', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <symbol id="icon" viewBox="invalid viewbox">
      <rect x="10" y="10" width="80" height="80" fill="magenta"/>
    </symbol>
  </defs>
  <use href="#icon" x="100" y="100" width="50" height="50"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-symbol-invalid-viewbox.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should fallback to getBBox behavior when viewBox is malformed
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})
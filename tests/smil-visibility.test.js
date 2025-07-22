const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SMIL Visibility Animation Support', () => {
  describe('Set element animations', () => {
    it('should exclude elements with set display="none"', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="50" height="50" fill="red">
    <set attributeName="display" to="none" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-display.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should only include the visible blue rectangle (80x80 at 50,50)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40) // 50-10 (buffer)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(100) // 80+20 (width + buffer*2)
        expect(result.newViewBox.height).toBe(100)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should exclude elements with set visibility="hidden"', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="40" fill="green" />
  <rect x="200" y="200" width="60" height="60" fill="red">
    <set attributeName="visibility" to="hidden" begin="1s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-visibility.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should only include the visible green circle (r=40 at cx=100,cy=100)
        // Circle bounds: (60,60) to (140,140), with buffer: (50,50) to (150,150)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(50)
        expect(result.newViewBox.y).toBe(50)
        expect(result.newViewBox.width).toBe(100) // 80+20 (diameter + buffer*2)
        expect(result.newViewBox.height).toBe(100)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should exclude elements with set opacity="0"', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="70" height="70" fill="red" opacity="1">
    <set attributeName="opacity" to="0" begin="2s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-opacity.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should only include the visible blue rectangle
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40) // 50-10
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(100) // 80+20
        expect(result.newViewBox.height).toBe(100)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should include elements with set animations that make them visible', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="70" height="70" fill="red" opacity="0">
    <set attributeName="opacity" to="1" begin="1s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-visible.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include both rectangles (conservative approach)
        // Blue: (50,50) to (130,130), Red: (200,200) to (270,270)
        // Combined: (50,50) to (270,270), with buffer: (40,40) to (280,280)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40) // 50-10
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(240) // 270-50+20 = 240
        expect(result.newViewBox.height).toBe(240)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Animate element opacity animations', () => {
    it('should include elements that animate opacity (conservative Phase 1 approach)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="70" height="70" fill="red" opacity="1">
    <animate attributeName="opacity" values="1;0" dur="2s" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-opacity-conservative.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include both rectangles (conservative: element is visible at some point)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(240)
        expect(result.newViewBox.height).toBe(240)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should include elements that animate opacity from 0 to visible', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="70" height="70" fill="red" opacity="0">
    <animate attributeName="opacity" values="0;1;0.5" dur="3s" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-opacity-show.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include both rectangles since opacity goes to visible values
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(240)
        expect(result.newViewBox.height).toBe(240)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex scenarios and fallbacks', () => {
    it('should fall back to including elements with complex timing (click events)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="70" height="70" fill="red">
    <set attributeName="display" to="none" begin="click" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-complex-timing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include both rectangles (conservative fallback for complex timing)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(240)
        expect(result.newViewBox.height).toBe(240)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Integration with existing visibility handling', () => {
    it('should work alongside static visibility attributes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="150" y="150" width="60" height="60" fill="green" display="none" />
  <rect x="250" y="200" width="70" height="70" fill="red">
    <set attributeName="opacity" to="0" begin="1s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-mixed-visibility.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should only include blue rectangle (green is static hidden, red is animated hidden)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(100)
        expect(result.newViewBox.height).toBe(100)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

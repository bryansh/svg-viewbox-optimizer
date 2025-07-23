const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Non-visual Element Support', () => {
  describe('Should ignore non-visual elements', () => {
    it('should ignore <view> elements (named views)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <view id="zoom" viewBox="50 50 100 100"/>
  <view id="overview" viewBox="0 0 300 300"/>
  <rect x="100" y="100" width="50" height="50" fill="blue"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-view-elements.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Only the rect should contribute to bounds, views should be ignored
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should ignore <cursor> elements', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <cursor id="crosshair" x="10" y="10"/>
  <rect x="100" y="100" width="50" height="50" fill="red"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-cursor-elements.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Only the rect should contribute to bounds, cursor should be ignored
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should ignore <a> elements but process their children', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <a href="https://example.com">
    <rect x="100" y="100" width="50" height="50" fill="green"/>
  </a>
  <rect x="200" y="200" width="30" height="30" fill="blue"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-a-elements.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Both rects should contribute to bounds (a element is just a container)
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(230, 1)
        expect(result.content.maxY).toBeCloseTo(230, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should ignore multiple non-visual elements together', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots">
      <circle r="5" fill="red"/>
    </pattern>
  </defs>
  <view id="zoom1" viewBox="0 0 200 200"/>
  <view id="zoom2" viewBox="100 100 200 200"/>
  <cursor id="pointer" x="20" y="20"/>
  <desc>This is a test SVG</desc>
  <title>Test SVG</title>
  <metadata>Created for testing</metadata>
  
  <rect x="150" y="150" width="40" height="40" fill="purple"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-mixed-non-visual.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Only the rect should contribute to bounds
        expect(result.content.minX).toBeCloseTo(150, 1)
        expect(result.content.minY).toBeCloseTo(150, 1)
        expect(result.content.maxX).toBeCloseTo(190, 1)
        expect(result.content.maxY).toBeCloseTo(190, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle <a> elements with animations on children', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <a href="https://example.com">
    <rect x="100" y="100" width="50" height="50" fill="orange">
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,0; 50,0; 0,0"
        dur="2s"
        repeatCount="indefinite"/>
    </rect>
  </a>
</svg>`

      const tempFile = path.join(__dirname, 'temp-a-animated.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Animation should extend bounds (rect moves from 100,100 to 150,100)
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(200, 1) // 150 + 50
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

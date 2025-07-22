const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SVG Image Element Support', () => {
  describe('Basic image support', () => {
    it('should include image elements with width and height', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue" />
  <image href="logo.png" x="100" y="100" width="80" height="60" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-basic.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should include both rect (50,50) to (110,110) and image (100,100) to (180,160)
        // Combined bounds: (50,50) to (180,160), with buffer: (40,40) to (190,170)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(150) // 190 - 40
        expect(result.newViewBox.height).toBe(130) // 170 - 40
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should support legacy xlink:href attribute', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image xlink:href="old-logo.png" x="50" y="50" width="100" height="80" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-xlink.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Image bounds: (50,50) to (150,130), with buffer: (40,40) to (160,140)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(120)
        expect(result.newViewBox.height).toBe(100)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle data URI images', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" 
         x="75" y="75" width="50" height="50" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-datauri.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Image bounds: (75,75) to (125,125), with buffer: (65,65) to (135,135)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(65)
        expect(result.newViewBox.y).toBe(65)
        expect(result.newViewBox.width).toBe(70)
        expect(result.newViewBox.height).toBe(70)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Image dimensions and positioning', () => {
    it('should handle images with only x/y positioning (default 0,0)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <image href="test.jpg" width="60" height="40" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-position.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Image at (0,0) with size 60x40, with buffer: (-10,-10) to (70,50)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(-10)
        expect(result.newViewBox.y).toBe(-10)
        expect(result.newViewBox.width).toBe(80)
        expect(result.newViewBox.height).toBe(60)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should skip images without width or height', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue" />
  <image href="unknown-size.png" x="100" y="100" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-no-dimensions.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should only include the rect, image without dimensions is skipped
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(80)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should skip images with zero width or height', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue" />
  <image href="zero-width.png" x="100" y="100" width="0" height="50" />
  <image href="zero-height.png" x="150" y="150" width="50" height="0" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-zero-dimensions.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should only include the rect, zero-dimension images are skipped
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(80)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Image visibility and effects', () => {
    it('should respect image visibility attributes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue" />
  <image href="hidden.png" x="100" y="100" width="80" height="60" display="none" />
  <image href="invisible.png" x="200" y="200" width="50" height="50" visibility="hidden" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-visibility.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should only include the visible rect, hidden images are excluded
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(80)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle images with transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <image href="transformed.png" x="0" y="0" width="50" height="50" 
         transform="translate(100,100) scale(2)" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-transform.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Base image: (0,0) to (50,50)
        // After translate(100,100) scale(2): (100,100) to (200,200)
        // With buffer: (90,90) to (210,210)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(90)
        expect(result.newViewBox.y).toBe(90)
        expect(result.newViewBox.width).toBe(120)
        expect(result.newViewBox.height).toBe(120)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should include images with opacity animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <image href="animated.png" x="50" y="50" width="80" height="60">
    <animate attributeName="opacity" values="0;1;0" dur="2s" />
  </image>
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-animated.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Image bounds: (50,50) to (130,110), with buffer: (40,40) to (140,120)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(100)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex image scenarios', () => {
    it('should handle mixed content with images and shapes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="40" height="40" fill="red" />
  <image href="background.jpg" x="0" y="0" width="500" height="400" opacity="0.3" />
  <circle cx="100" cy="100" r="20" fill="blue" />
  <image href="overlay.png" x="200" y="150" width="60" height="80" />
  <text x="300" y="200" font-size="16">Hello World</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-mixed.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should include all visible elements
        // Background image dominates: (0,0) to (500,400)
        // With buffer: (-10,-10) to (510,410)
        expect(result.elements.count).toBe(5)
        expect(result.newViewBox.x).toBe(-10)
        expect(result.newViewBox.y).toBe(-10)
        expect(result.newViewBox.width).toBe(520)
        expect(result.newViewBox.height).toBe(420)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle images with preserveAspectRatio', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <image href="aspect-ratio.png" x="50" y="50" width="100" height="100" 
         preserveAspectRatio="xMidYMid meet" />
</svg>`

      const tempFile = path.join(__dirname, 'temp-image-aspect-ratio.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Image bounds: (50,50) to (150,150), with buffer: (40,40) to (160,160)
        // preserveAspectRatio affects rendering but not geometric bounds
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(120)
        expect(result.newViewBox.height).toBe(120)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})
const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SVG Text Elements with Web Fonts', () => {
  describe('Basic text element support', () => {
    it('should handle text elements with system fonts', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <text x="50" y="100" font-family="Arial" font-size="24">Hello World</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-system-font.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Text should be included in bounds calculation
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBeLessThan(50) // Text extends before x=50
        expect(result.newViewBox.y).toBeLessThan(100) // Text extends above y=100
        expect(result.newViewBox.width).toBeGreaterThan(50) // Text has substantial width
        expect(result.newViewBox.height).toBeGreaterThan(20) // Text has height
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle text elements with web fonts', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400&amp;display=swap');
      .roboto-text { font-family: 'Roboto', sans-serif; }
    </style>
  </defs>
  <text x="50" y="100" class="roboto-text" font-size="32">Web Font Test</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-web-font.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Web font text should be included
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.width).toBeGreaterThan(100) // Substantial text width
        expect(result.newViewBox.height).toBeGreaterThan(30) // Text height
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 10000) // Longer timeout for web font loading

    it('should handle mixed web fonts and fallbacks', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 500 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300&amp;display=swap');
    </style>
  </defs>
  <text x="50" y="50" font-family="'Inter', Arial, sans-serif" font-size="18">Primary text with fallback</text>
  <text x="50" y="100" font-family="Arial" font-size="18">System font text</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-mixed-fonts.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Both text elements should be included
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.width).toBeGreaterThan(150)
        expect(result.newViewBox.height).toBeGreaterThan(50)
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 10000)
  })

  describe('Font loading edge cases', () => {
    it('should handle text with custom font-face definitions', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'CustomFont';
        src: url('https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2') format('woff2');
        font-display: swap;
      }
      .custom-font { 
        font-family: 'CustomFont', 'Times New Roman', serif; 
      }
    </style>
  </defs>
  <text x="50" y="100" class="custom-font" font-size="24">Custom Font Test</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-custom-font.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Text should be included even if custom font fails to load
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.width).toBeGreaterThan(80) // Fallback font should still render
        expect(result.newViewBox.height).toBeGreaterThan(20)
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 10000)

    it('should handle text with nonexistent web fonts', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <text x="50" y="100" font-family="'NonExistentFont', Arial, sans-serif" font-size="20">Fallback Font Test</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-nonexistent-font.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should fall back to Arial and work correctly
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.width).toBeGreaterThan(70)
        expect(result.newViewBox.height).toBeGreaterThan(20)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Text with animations and transforms', () => {
    it('should handle animated text with web fonts', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 500 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400&amp;display=swap');
    </style>
  </defs>
  <text x="50" y="100" font-family="'Open Sans', sans-serif" font-size="28">
    Animated Text
    <animate attributeName="x" values="50;200;50" dur="3s" repeatCount="indefinite" />
  </text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-animated-webfont.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Should include animated text bounds
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.width).toBeGreaterThan(200) // Animation extends text position
        expect(result.newViewBox.height).toBeGreaterThan(25)
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 10000)

    it('should handle text with transforms and web fonts', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600&amp;display=swap');
    </style>
  </defs>
  <text x="0" y="0" font-family="'Poppins', Arial, sans-serif" font-size="24" 
        transform="translate(100,100) rotate(45)">
    Rotated Text
  </text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-transform-webfont.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        
        // Transformed text should be included with expanded bounds
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.width).toBeGreaterThan(50)
        expect(result.newViewBox.height).toBeGreaterThan(50)
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 10000)
  })

  describe('Performance and reliability', () => {
    it('should handle multiple web font text elements efficiently', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&amp;display=swap');
      .light { font-family: 'Roboto', sans-serif; font-weight: 300; }
      .normal { font-family: 'Roboto', sans-serif; font-weight: 400; }
      .bold { font-family: 'Roboto', sans-serif; font-weight: 700; }
    </style>
  </defs>
  <text x="50" y="50" class="light" font-size="16">Light text</text>
  <text x="50" y="100" class="normal" font-size="18">Normal text</text>
  <text x="50" y="150" class="bold" font-size="20">Bold text</text>
  <text x="300" y="200" class="normal" font-size="24">More text content</text>
</svg>`

      const tempFile = path.join(__dirname, 'temp-text-multiple-webfonts.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const startTime = Date.now()
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        const endTime = Date.now()
        
        // All text elements should be included
        expect(result.elements.count).toBe(4)
        expect(result.newViewBox.width).toBeGreaterThan(200)
        expect(result.newViewBox.height).toBeGreaterThan(150)
        
        // Should complete in reasonable time (even with font loading)
        expect(endTime - startTime).toBeLessThan(15000) // 15 second max
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 30000) // Extended timeout for multiple fonts with font loading synchronization
  })
})
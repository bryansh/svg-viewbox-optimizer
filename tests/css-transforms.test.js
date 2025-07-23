const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

const fixturesDir = path.join(__dirname, 'fixtures')

describe('CSS Transform Support', () => {
  describe('CSS transform property detection', () => {
    it('should handle inline style CSS transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="30" height="30" fill="blue" style="transform: translateX(50px)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-inline.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect CSS transform and include translated position
        // Original rect at x=50, translated by 50px = final x position 100
        // With 30px width, total bounds go from x=100 to x=130 (100+30)
        expect(result.content.minX).toBeCloseTo(100, 1) // Translated position
        expect(result.content.maxX).toBeCloseTo(130, 1) // Translated position + width
        expect(result.elements.count).toBe(1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle CSS transform with translate', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
  <style>
    .translated { transform: translate(40px, 20px); }
  </style>
  <circle cx="30" cy="30" r="15" fill="red" class="translated"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-translate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Circle at cx=30,cy=30 with r=15, translated by (40,20)
        // Original bounds: (15,15) to (45,45), after translate(40,20): (55,35) to (85,65)
        expect(result.content.minX).toBeCloseTo(55, 1) // 15+40 = 55
        expect(result.content.maxX).toBeCloseTo(85, 1) // 45+40 = 85
        expect(result.content.minY).toBeCloseTo(35, 1) // 15+20 = 35
        expect(result.content.maxY).toBeCloseTo(65, 1) // 45+20 = 65
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle CSS transform with scale', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .scaled { transform: scale(2, 1.5); }
  </style>
  <rect x="60" y="60" width="20" height="20" fill="green" class="scaled"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-scale.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Rect at (60,60) 20x20 scaled by (2, 1.5)
        // Scale transforms around origin, so final size is 40x30
        expect(result.content.width).toBeGreaterThan(35) // Should be wider due to scale
        expect(result.content.height).toBeGreaterThan(25) // Should be taller due to scale
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle CSS transform with rotation', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <style>
    .rotated { transform: rotate(45deg); }
  </style>
  <rect x="30" y="30" width="20" height="10" fill="purple" class="rotated"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-rotate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // 45 degree rotation should expand the bounding box due to rotation
        expect(result.elements.count).toBe(1)
        expect(result.savings.percentage).toBeGreaterThan(0) // Should still optimize
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle combined CSS transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg">
  <style>
    .complex { transform: translate(50px, 30px) scale(1.5) rotate(30deg); }
  </style>
  <rect x="40" y="40" width="25" height="25" fill="orange" class="complex"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-complex.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Complex transform combining translation, scale, and rotation
        expect(result.elements.count).toBe(1)
        expect(result.savings.percentage).toBeGreaterThan(20) // Should achieve good optimization
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should prioritize CSS transforms over SVG transform attributes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="30" height="30" fill="blue" 
        transform="translate(10, 10)"
        style="transform: translateX(60px)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-priority.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // CSS transform should take priority over SVG transform
        // CSS translateX(60px) should override SVG translate(10,10)
        // Final position: x=50 + 60 = 110, width=30, so x=110 to x=140
        expect(result.content.minX).toBeCloseTo(110, 1) // CSS transformed position
        expect(result.content.maxX).toBeCloseTo(140, 1) // 110 + 30 = 140
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('CSS transform inheritance', () => {
    it('should handle nested elements with CSS transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    .parent-transform { transform: translate(50px, 40px); }
    .child-transform { transform: scale(1.2); }
  </style>
  <g class="parent-transform">
    <rect x="60" y="60" width="30" height="30" fill="red" class="child-transform"/>
  </g>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-nested.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should combine parent translation with child scaling
        // Rect (60,60) 30x30 -> scale(1.2) -> (72,72) 36x36 -> translate(50,40) -> (122,112) 36x36
        expect(result.elements.count).toBe(2) // group + rect
        expect(result.content.minX).toBeCloseTo(122, 1) // 60*1.2+50 = 122
        expect(result.content.maxX).toBeCloseTo(158, 1) // 90*1.2+50 = 158
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle mixed SVG and CSS transforms in hierarchy', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .css-transform { transform: translateY(30px); }
  </style>
  <g transform="translate(20, 10)">
    <rect x="40" y="40" width="25" height="25" fill="green" class="css-transform"/>
  </g>
</svg>`

      const tempFile = path.join(__dirname, 'temp-mixed-transforms.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // CSS transform on rect should take priority over its SVG transform (if any)
        // But parent group SVG transform should still apply
        // Rect (40,40) -> CSS translateY(30) -> (40,70) -> Group translate(20,10) -> (60,80)
        expect(result.elements.count).toBe(2) // group + rect
        expect(result.content.minX).toBeCloseTo(60, 1) // 40 + 20 = 60 (group SVG transform)
        expect(result.content.minY).toBeCloseTo(80, 1) // 40 + 30 + 10 = 80 (rect CSS + group SVG)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('CSS transform with effects', () => {
    it('should handle CSS transforms with filters', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .transformed-filtered { 
      transform: translate(40px, 30px);
      filter: blur(5px);
    }
  </style>
  <rect x="50" y="50" width="30" height="30" fill="blue" class="transformed-filtered"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-transform-filter.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should account for both CSS transform and filter expansion
        expect(result.elements.count).toBe(1)
        expect(result.elements.effectsCount).toBe(1) // Has filter

        // Transform moves rect from (50,50) to (90,80), filter blur(5px) expands by ~15px
        // Final bounds: (75,65) to (135,125) including filter expansion
        expect(result.content.minX).toBeCloseTo(75, 1) // 50+40-15 = 75 (transform + filter expansion)
        expect(result.content.maxX).toBeCloseTo(135, 1) // 50+40+30+15 = 135 (transform + width + filter)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('CSS transform edge cases', () => {
    it('should handle transform: none', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="30" height="30" fill="red" style="transform: none"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-none.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // transform: none should be treated as no transform
        expect(result.content.minX).toBeCloseTo(40, 1)
        expect(result.content.maxX).toBeCloseTo(70, 1) // 40 + 30
      } finally {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile)
        }
      }
    })

    it('should handle invalid CSS transform values gracefully', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="30" height="30" fill="red" style="transform: invalid-function(50px)"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-invalid.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Invalid transform should fall back to no transform
        expect(result.elements.count).toBe(1)
        expect(result.content.minX).toBeCloseTo(40, 1)
        expect(result.content.maxX).toBeCloseTo(70, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle CSS matrix() function', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .matrix-transform { transform: matrix(1, 0, 0, 1, 50, 30); }
  </style>
  <rect x="40" y="40" width="25" height="25" fill="purple" class="matrix-transform"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-matrix.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // matrix(1,0,0,1,50,30) is equivalent to translate(50px, 30px)
        // Rect (40,40) 25x25 -> translate(50,30) -> (90,70) 25x25
        expect(result.content.minX).toBeCloseTo(90, 1) // 40+50 = 90
        expect(result.content.maxX).toBeCloseTo(115, 1) // 40+50+25 = 115
        expect(result.content.minY).toBeCloseTo(70, 1) // 40+30 = 70
        expect(result.content.maxY).toBeCloseTo(95, 1) // 40+30+25 = 95
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle external stylesheets by inlining them', async () => {
      const input = path.join(fixturesDir, 'test-external-stylesheet.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Should detect all elements
      expect(result.elements.count).toBe(3)

      // External CSS transforms should be applied
      // Rotated rectangle should expand bounds
      expect(result.content.width).toBeGreaterThan(100)

      // Scaled rectangle should double in size
      // Original at (150,50) 30x30, scaled 2x should affect bounds
      expect(result.content.maxX).toBeGreaterThan(200)

      // Should optimize despite external styles
      expect(result.original.viewBox).toBe('0 0 300 300')
    })

    it('should handle @import statements in style blocks', async () => {
      const input = path.join(fixturesDir, 'test-import-stylesheet.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Should detect both elements
      expect(result.elements.count).toBe(2)

      // Imported skewX transform should be applied
      // Rectangle with skewX(15deg) should expand bounds horizontally
      expect(result.content.width).toBeGreaterThan(80)

      // Local translateY should also work
      expect(result.content.maxY).toBeGreaterThan(100) // Circle at y=80+20+20 radius

      expect(result.original.viewBox).toBe('0 0 200 200')
    })
  })
})

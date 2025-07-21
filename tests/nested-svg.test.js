const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Nested SVG Support', () => {
  describe('Basic nested SVG elements', () => {
    it('should handle nested SVG with coordinate transformation', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="40" fill="blue"/>
  <svg x="200" y="150" width="100" height="80" viewBox="0 0 50 40">
    <circle cx="25" cy="20" r="15" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-basic.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Expected bounds calculation:
        // Outer rect: (50,50) to (110,90)
        // Nested circle: cx=25, cy=20, r=15 in viewBox 0 0 50 40
        //   - Circle bounds in nested space: (10,5) to (40,35)
        //   - Scaled to viewport 100x80: (20,10) to (80,70)
        //   - Positioned at (200,150): (220,160) to (280,220)
        // Final content bounds: (50,50) to (280,220)
        expect(result.content.minX).toBeCloseTo(50, 1)
        expect(result.content.minY).toBeCloseTo(50, 1)
        expect(result.content.maxX).toBeCloseTo(280, 1)
        expect(result.content.maxY).toBeCloseTo(220, 1)
        expect(result.elements.count).toBe(2) // Should include outer rect and nested circle
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle nested SVG with transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="50" height="30" fill="green"/>
  <g transform="translate(30, 20)">
    <svg x="100" y="100" width="80" height="60" viewBox="0 0 40 30">
      <rect x="10" y="10" width="20" height="10" fill="purple"/>
    </svg>
  </g>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-transform.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Expected bounds:
        // Outer rect: (40,40) to (90,70)
        // Group transform: translate(30,20)
        // Nested SVG positioned at (100+30, 100+20) = (130,120)
        // Inner rect: x=10, y=10, w=20, h=10 in viewBox 0 0 40 30
        //   - Scaled to 80x60 viewport: (20,20) to (60,40)
        //   - Final position: (130+20, 120+20) to (130+60, 120+40) = (150,140) to (190,160)
        expect(result.content.minX).toBeCloseTo(40, 1)
        expect(result.content.minY).toBeCloseTo(40, 1)
        expect(result.content.maxX).toBeCloseTo(190, 1)
        expect(result.content.maxY).toBeCloseTo(160, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle deeply nested SVG elements', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
  <svg x="100" y="100" width="200" height="150" viewBox="0 0 100 75">
    <rect x="20" y="20" width="30" height="20" fill="orange"/>
    <svg x="60" y="40" width="30" height="25" viewBox="0 0 15 12">
      <circle cx="7" cy="6" r="4" fill="cyan"/>
    </svg>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-deep.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Complex nested calculation:
        // Level 1: SVG at (100,100) with 200x150 viewport, viewBox 0 0 100 75 (scale 2.0, 2.0)
        // Level 2 rect: (20,20) size 30x20 -> transformed to (140,140) size 60x40
        // Level 2 SVG: at (60,40) with 30x25 viewport, viewBox 0 0 15 12 (nested transform)
        //   - Circle: cx=7, cy=6, r=4 -> bounds (3,2) size 8x8 -> transformed to ~(232,188) size ~32x33
        expect(result.content.minX).toBeCloseTo(140, 1)
        expect(result.content.minY).toBeCloseTo(140, 1)
        expect(result.content.maxX).toBeCloseTo(264, 1)
        expect(result.content.maxY).toBeCloseTo(221, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Nested SVG with animations', () => {
    it('should handle animations inside nested SVG', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="40" height="30" fill="blue"/>
  <svg x="150" y="100" width="120" height="80" viewBox="0 0 60 40">
    <rect x="10" y="10" width="20" height="15" fill="red">
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0 0; 30 0; 0 0"
        dur="2s"
        repeatCount="indefinite"/>
    </rect>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-animated.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Expected bounds:
        // Outer rect: (50,50) to (90,80)
        // Nested SVG at (150,100) with 120x80 viewport, viewBox 0 0 60 40
        // Animated rect: base (10,10) to (30,25), animates translate(0,0) to (30,0)
        //   - Animation bounds in nested space: (10,10) to (60,25)
        //   - Scaled to 120x80 viewport: (20,20) to (120,50)
        //   - Final position: (150+20, 100+20) to (150+120, 100+50) = (170,120) to (270,150)
        expect(result.elements.animationCount).toBeGreaterThan(0)
        expect(result.content.minX).toBeCloseTo(50, 1)
        expect(result.content.minY).toBeCloseTo(50, 1)
        expect(result.content.maxX).toBeCloseTo(270, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animateMotion inside nested SVG', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="20" fill="green"/>
  <svg x="100" y="100" width="100" height="80" viewBox="0 0 50 40">
    <path id="motionPath" d="M 10,20 Q 25,10 40,20" stroke="none" fill="none"/>
    <circle r="5" fill="orange">
      <animateMotion dur="3s" repeatCount="indefinite">
        <mpath href="#motionPath"/>
      </animateMotion>
    </circle>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-motion.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Expected bounds:
        // Outer circle: (30,30) to (70,70)
        // Nested SVG at (100,100) with 100x80 viewport, viewBox 0 0 50 40
        // Motion path from (10,20) to (40,20) with curve to (25,10)
        //   - Path bounds approximately (10,10) to (40,20) plus circle radius 5 = (5,5) to (45,25)
        //   - Scaled to 100x80 viewport: (10,10) to (90,50)
        //   - Final position: (100+10, 100+10) to (100+90, 100+50) = (110,110) to (190,150)
        expect(result.elements.animationCount).toBeGreaterThan(0)
        expect(result.content.minX).toBeCloseTo(30, 1)
        expect(result.content.minY).toBeCloseTo(30, 1)
        expect(result.content.maxX).toBeCloseTo(190, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle complex nested animations with transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 500 400" xmlns="http://www.w3.org/2000/svg">
  <rect x="30" y="30" width="40" height="25" fill="purple"/>
  <g transform="scale(1.5) translate(20, 10)">
    <svg x="80" y="60" width="100" height="80" viewBox="0 0 50 40">
      <rect x="5" y="5" width="15" height="10" fill="yellow">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0 0; 25 20; 0 0"
          dur="4s"
          repeatCount="indefinite"/>
      </rect>
      <circle cx="35" cy="25" r="8" fill="pink">
        <animate
          attributeName="r"
          values="8; 15; 8"
          dur="3s"
          repeatCount="indefinite"/>
      </circle>
    </svg>
  </g>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-complex.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Complex calculation with group transform and nested animations
        // Group transform: scale(1.5) translate(20,10)
        // Nested SVG positioned at transformed (80,60) with 100x80 viewport
        // Multiple animations inside affecting final bounds
        expect(result.elements.animationCount).toBeGreaterThan(1)
        expect(result.elements.count).toBeGreaterThan(3)
        expect(result.content.width).toBeGreaterThan(200) // Should span significant area
        expect(result.content.height).toBeGreaterThan(150)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle nested SVG with no viewBox', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="30" height="20" fill="blue"/>
  <svg x="80" y="60" width="60" height="40">
    <circle cx="30" cy="20" r="12" fill="red"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-no-viewbox.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Without viewBox, nested SVG should use viewport coordinates directly
        // Circle at (80+30, 60+20) = (110,80) with r=12 -> bounds (98,68) to (122,92)
        expect(result.content.minX).toBeCloseTo(20, 1)
        expect(result.content.minY).toBeCloseTo(20, 1)
        expect(result.content.maxX).toBeCloseTo(122, 1)
        expect(result.content.maxY).toBeCloseTo(92, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle nested SVG with preserveAspectRatio', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="50" height="30" fill="green"/>
  <svg x="120" y="80" width="80" height="60" viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
    <rect x="10" y="10" width="20" height="20" fill="orange"/>
  </svg>
</svg>`

      const tempFile = path.join(__dirname, 'temp-nested-aspect-ratio.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // With preserveAspectRatio, the 40x40 viewBox should be fitted into 80x60 viewport
        // This creates a 60x60 effective area centered in the 80x60 space
        expect(result.content.minX).toBeCloseTo(40, 1)
        expect(result.content.minY).toBeCloseTo(40, 1)
        expect(result.elements.count).toBe(2) // Should include outer rect and nested rect
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

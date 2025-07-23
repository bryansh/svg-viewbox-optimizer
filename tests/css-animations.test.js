const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('CSS Animation Support', () => {
  describe('Transform-based CSS animations', () => {
    it('should expand bounds for CSS translate animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes move {
      0% { transform: translate(0, 0); }
      100% { transform: translate(50px, 30px); }
    }
    .animated {
      animation: move 2s infinite;
    }
  </style>
  <rect x="100" y="100" width="50" height="40" class="animated" fill="blue"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-translate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Original rect at (100,100) size 50x40
        // Animation moves it to (150,130) - bounds should include both positions
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(200, 1) // 150 + 50
        expect(result.content.maxY).toBeCloseTo(170, 1) // 130 + 40
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should expand bounds for CSS scale animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes grow {
      0% { transform: scale(1); }
      100% { transform: scale(2); }
    }
    .scaling {
      animation: grow 1s infinite;
      transform-origin: center;
    }
  </style>
  <rect x="100" y="100" width="50" height="50" class="scaling" fill="green"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-scale.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Original rect at (100,100) size 50x50, center at (125,125)
        // 2x scale from center: expands 25px in each direction
        // Final bounds: (75,75) to (175,175)
        expect(result.content.minX).toBeCloseTo(75, 1)
        expect(result.content.minY).toBeCloseTo(75, 1)
        expect(result.content.maxX).toBeCloseTo(175, 1)
        expect(result.content.maxY).toBeCloseTo(175, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should expand bounds for CSS rotation animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(90deg); }
    }
    .rotating {
      animation: spin 2s infinite;
      transform-origin: center;
    }
  </style>
  <rect x="100" y="120" width="60" height="20" class="rotating" fill="red"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-rotate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Original rect at (100,120) size 60x20, center at (130,130)
        // 90° rotation should create bounds that accommodate both orientations
        // The diagonal of the rect should fit within bounds
        expect(result.content.minX).toBeLessThanOrEqual(100)
        expect(result.content.minY).toBeLessThanOrEqual(110) // Should expand upward from rotation
        expect(result.content.maxX).toBeGreaterThanOrEqual(160)
        expect(result.content.maxY).toBeGreaterThanOrEqual(150) // Should expand downward from rotation
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle complex multi-keyframe animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes complex {
      0% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(50px, 0) scale(1.5); }
      50% { transform: translate(50px, 50px) scale(1); }
      75% { transform: translate(0, 50px) scale(0.5); }
      100% { transform: translate(0, 0) scale(1); }
    }
    .complex-anim {
      animation: complex 4s infinite;
      transform-origin: center;
    }
  </style>
  <rect x="150" y="150" width="40" height="40" class="complex-anim" fill="purple"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-complex.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should include all extreme positions from the animation
        // Original rect at (150,150) size 40x40, center at (170,170)
        // 25%: translate(50,0) scale(1.5) → (215,140) size 60x60 → maxX=275, minY=140
        // 75%: translate(0,50) scale(0.5) → (160,185) size 20x20 → no leftward movement
        expect(result.content.minX).toBeCloseTo(150, 1) // Element starts at x=150, never moves further left
        expect(result.content.minY).toBeCloseTo(140, 1) // From 25% keyframe: 1.5x scale expands upward to 140
        expect(result.content.maxX).toBeCloseTo(275, 1) // From 25% keyframe: bounds(215,140,60,60) → maxX=275
        expect(result.content.maxY).toBeCloseTo(240, 1) // From envelope calculation
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Animation direction support', () => {
    it('should handle reverse animation direction', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes slideRight {
      0% { transform: translateX(0); }
      100% { transform: translateX(80px); }
    }
    .reverse-anim {
      animation: slideRight 2s infinite reverse;
    }
  </style>
  <rect x="100" y="100" width="30" height="30" class="reverse-anim" fill="orange"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-reverse.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Reverse direction should still include same bounds as forward
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(210, 1) // 100 + 80 + 30
        expect(result.content.maxY).toBeCloseTo(130, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle alternate animation direction', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes bounce {
      0% { transform: translateY(0); }
      100% { transform: translateY(-40px); }
    }
    .bouncing {
      animation: bounce 1s infinite alternate;
    }
  </style>
  <circle cx="150" cy="150" r="20" class="bouncing" fill="cyan"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-alternate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Alternate should include both forward and reverse directions
        expect(result.content.minX).toBeCloseTo(130, 1) // cx - r
        expect(result.content.minY).toBeCloseTo(90, 1) // cy - r - 40
        expect(result.content.maxX).toBeCloseTo(170, 1) // cx + r
        expect(result.content.maxY).toBeCloseTo(170, 1) // cy + r
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Transform origin support', () => {
    it('should handle custom transform origins', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes scaleFromCorner {
      0% { transform: scale(1); }
      100% { transform: scale(2); }
    }
    .corner-scale {
      animation: scaleFromCorner 2s infinite;
      transform-origin: top left;
    }
  </style>
  <rect x="100" y="100" width="50" height="50" class="corner-scale" fill="yellow"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-origin.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Scale from top-left corner: rect grows right and down
        expect(result.content.minX).toBeCloseTo(100, 1) // No change in left edge
        expect(result.content.minY).toBeCloseTo(100, 1) // No change in top edge
        expect(result.content.maxX).toBeCloseTo(200, 1) // 100 + 50*2
        expect(result.content.maxY).toBeCloseTo(200, 1) // 100 + 50*2
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Multiple elements with CSS animations', () => {
    it('should handle multiple animated elements', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes moveLeft {
      0% { transform: translateX(0); }
      100% { transform: translateX(-60px); }
    }
    @keyframes moveRight {
      0% { transform: translateX(0); }
      100% { transform: translateX(60px); }
    }
    .left-mover {
      animation: moveLeft 2s infinite;
    }
    .right-mover {
      animation: moveRight 2s infinite;
    }
  </style>
  <rect x="100" y="100" width="40" height="40" class="left-mover" fill="blue"/>
  <rect x="200" y="150" width="40" height="40" class="right-mover" fill="red"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-multiple.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // First rect: (100,100) moves to (40,100)
        // Second rect: (200,150) moves to (260,150)
        expect(result.content.minX).toBeCloseTo(40, 1) // Left-moving rect
        expect(result.content.minY).toBeCloseTo(100, 1) // Top of first rect
        expect(result.content.maxX).toBeCloseTo(300, 1) // Right-moving rect: 260 + 40
        expect(result.content.maxY).toBeCloseTo(190, 1) // Bottom of second rect: 150 + 40
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('CSS animations with SVG animations', () => {
    it('should handle elements with both CSS and SVG animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes cssMove {
      0% { transform: translateX(0); }
      100% { transform: translateX(40px); }
    }
    .css-animated {
      animation: cssMove 2s infinite;
    }
  </style>
  <rect x="100" y="100" width="30" height="30" class="css-animated" fill="magenta">
    <!-- SVG animation that moves the element vertically -->
    <animateTransform attributeName="transform" type="translate" 
                      values="0,0; 0,50" dur="3s" repeatCount="indefinite"/>
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-svg-combo.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should include bounds from both CSS (horizontal) and SVG (vertical) animations
        expect(result.content.minX).toBeCloseTo(100, 1) // Original position
        expect(result.content.minY).toBeCloseTo(100, 1) // Original position
        expect(result.content.maxX).toBeCloseTo(170, 1) // CSS: 100 + 40 + 30
        expect(result.content.maxY).toBeCloseTo(180, 1) // SVG: 100 + 50 + 30
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 60000) // Longer timeout for complex animation analysis
  })

  describe('Edge cases', () => {
    it('should handle elements with no CSS animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    .static {
      fill: green;
    }
  </style>
  <rect x="100" y="100" width="50" height="50" class="static"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-none.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should just use the static bounds
        expect(result.content.minX).toBeCloseTo(100, 1)
        expect(result.content.minY).toBeCloseTo(100, 1)
        expect(result.content.maxX).toBeCloseTo(150, 1)
        expect(result.content.maxY).toBeCloseTo(150, 1)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animation: none', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <style>
    @keyframes unused {
      0% { transform: translateX(0); }
      100% { transform: translateX(100px); }
    }
    .no-animation {
      animation: none;
    }
  </style>
  <rect x="100" y="100" width="50" height="50" class="no-animation"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-disabled.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 0 })

        // Should ignore the keyframes since animation is set to none
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

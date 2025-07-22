const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SMIL Phase 3 Advanced Animation Support', () => {
  describe('fill="freeze" attribute support', () => {
    it('should persist final animation values with fill="freeze"', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" from="50" to="150" dur="2s" fill="freeze" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-fill-freeze.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include both start (50) and end (150) positions
        // Bounds: (50,50) to (210,110), with buffer: (40,40) to (220,120)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(180)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle fill="remove" (default behavior)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" from="50" to="150" dur="2s" fill="remove" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-fill-remove.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Same bounds as freeze - we consider all animation values
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(180)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('from/by animation support', () => {
    it('should handle from/by animations correctly', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="50" height="50" fill="red">
    <animate attributeName="x" from="100" by="80" dur="2s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-from-by.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // from="100" by="80" means animate from 100 to 180
        // Bounds: (100,100) to (230,150), with buffer: (90,90) to (240,160)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(90)
        expect(result.newViewBox.y).toBe(90)
        expect(result.newViewBox.width).toBe(150) // 240 - 90
        expect(result.newViewBox.height).toBe(70) // 160 - 90
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle by-only animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="30" fill="green">
    <animate attributeName="cx" by="100" dur="2s" />
  </circle>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-by-only.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // by="100" without from means relative animation
        // Conservative approach: consider from cx=0 to cx=100 (the 'by' value)
        // Original circle at cx=100: (70,70) to (130,130)
        // Animation range from cx=0 to cx=100: (-30,70) to (130,130)
        // Combined: (-30,70) to (130,130), with buffer: (-40,60) to (140,140)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(-40)
        expect(result.newViewBox.y).toBe(60)
        expect(result.newViewBox.width).toBe(180)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle from/by with transforms', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animateTransform attributeName="transform" type="translate" from="0,0" by="100,50" dur="2s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-transform-by.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // from="0,0" by="100,50" means translate from (0,0) to (100,50)
        // Base rect: (50,50) to (110,110)
        // Translated by (100,50): (150,100) to (210,160)
        // Combined: (50,50) to (210,160), with buffer: (40,40) to (220,170)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(180)
        expect(result.newViewBox.height).toBe(130)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('discrete calcMode support', () => {
    it('should handle discrete calcMode (all values considered)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="purple">
    <animate attributeName="x" values="50;150;100" calcMode="discrete" dur="3s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-discrete.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Discrete mode jumps between values: 50, 150, 100
        // All positions should be considered
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(180) // Covers x=50 to x=150+60
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('syncbase timing support', () => {
    it('should handle basic syncbase timing (anim.begin)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate id="anim1" attributeName="x" from="50" to="150" dur="2s" />
  </rect>
  <rect x="200" y="200" width="40" height="40" fill="red">
    <set attributeName="opacity" to="0" begin="anim1.begin" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-syncbase-begin.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Conservative: both elements included even though red rect might be hidden
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(210) // Covers both rectangles
        expect(result.newViewBox.height).toBe(210)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle syncbase timing with offset (anim.end+1s)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="30" fill="green">
    <animate id="move" attributeName="cx" from="100" to="200" dur="2s" />
  </circle>
  <rect x="250" y="50" width="40" height="40" fill="orange">
    <animate attributeName="y" from="50" to="150" begin="move.end+0.5s" dur="1s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-syncbase-offset.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include all animated positions for both elements
        // Circle: cx from 100 to 200, bounds (70,70) to (230,130)
        // Rect: y from 50 to 150, bounds (250,50) to (290,190)
        // Combined: (70,50) to (290,190), with buffer: (60,40) to (300,200)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(60)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(240)
        expect(result.newViewBox.height).toBe(160)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('repeatDur attribute support', () => {
    it('should handle repeatDur attribute', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" from="50" to="150" dur="1s" repeatDur="3s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-repeatdur.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Animation repeats for 3 seconds (3 times with 1s duration)
        // Bounds remain same as single animation
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(180)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('accumulate attribute support', () => {
    it('should handle accumulate="sum" for additive animations', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" from="0" to="50" dur="1s" repeatCount="3" accumulate="sum" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-accumulate.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // With accumulate="sum", each repeat adds to previous
        // Conservative approach: consider all possible values
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBeLessThanOrEqual(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBeGreaterThanOrEqual(70)
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex Phase 3 scenarios', () => {
    it('should handle multiple Phase 3 features together', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="30" fill="blue">
    <animate id="circleMove" attributeName="cx" from="100" by="100" dur="2s" fill="freeze" />
  </circle>
  <rect x="50" y="200" width="60" height="60" fill="red">
    <animate attributeName="x" values="50;150;100" calcMode="discrete" begin="circleMove.end" dur="3s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-complex-phase3.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Circle: cx from 100 to 200 (100+100), bounds (70,70) to (230,130)
        // Rect: x values 50,150,100 starting after circle, bounds (50,200) to (210,260)
        // Combined: (50,70) to (230,260), with buffer: (40,60) to (240,270)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(60)
        expect(result.newViewBox.width).toBe(200)
        expect(result.newViewBox.height).toBe(210)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle keySplines with spline calcMode', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="green">
    <animate attributeName="x" values="50;200;100" keyTimes="0;0.7;1" 
             calcMode="spline" keySplines="0.5 0 0.5 1;0.5 0 0.5 1" dur="3s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-keysplines.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Spline interpolation doesn't change bounds calculation
        // All keyframe values are still considered: x=50, 200, 100
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(230) // Covers x=50 to x=200+60
        expect(result.newViewBox.height).toBe(80)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

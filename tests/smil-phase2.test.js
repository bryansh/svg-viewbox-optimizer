const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SMIL Phase 2 Animation Support', () => {
  describe('Expanded animate element support', () => {
    it('should handle animate on cx/cy for circles', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="30" fill="blue">
    <animate attributeName="cx" values="100;200;150" dur="2s" begin="0s" />
  </circle>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-cx.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include all positions from cx animation: 100, 200, 150
        // Circle bounds: r=30, so cx values create bounds from (70,70) to (230,130)
        // With buffer: (60,60) to (240,140)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(60) // min(100,200,150) - 30 - 10
        expect(result.newViewBox.y).toBe(60) // cy=100 - r=30 - buffer=10
        expect(result.newViewBox.width).toBe(180) // (max_cx + r + buffer) - min_x = (200+30+10) - 60
        expect(result.newViewBox.height).toBe(80) // (cy + r + buffer) - min_y = (100+30+10) - 60
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animate on r for circles', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="150" cy="150" r="20" fill="red">
    <animate attributeName="r" values="20;50;30" dur="3s" begin="0s" />
  </circle>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-r.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include all radius values: 20, 50, 30
        // Max radius is 50, so bounds are (150-50, 150-50) to (150+50, 150+50)
        // With buffer: (90, 90) to (210, 210)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(90) // 150 - 50 - 10
        expect(result.newViewBox.y).toBe(90)
        expect(result.newViewBox.width).toBe(120) // 210 - 90
        expect(result.newViewBox.height).toBe(120)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animate on stroke-width', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="60" height="40" fill="none" stroke="black" stroke-width="2">
    <animate attributeName="stroke-width" values="2;20;10" dur="2s" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-stroke-width.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Max stroke-width is 20, so extends bounds by 10 on each side
        // Base rect: (100,100) to (160,140)
        // With max stroke: (90,90) to (170,150)
        // With buffer: (80,80) to (180,160)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(80) // 100 - 10 (half max stroke) - 10 (buffer)
        expect(result.newViewBox.y).toBe(80)
        expect(result.newViewBox.width).toBe(100) // 180 - 80
        expect(result.newViewBox.height).toBe(80) // 160 - 80
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle animate on opacity without affecting bounds', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue">
    <animate attributeName="opacity" values="1;0.5;1" dur="2s" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-animate-opacity-bounds.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Opacity animations don't affect geometric bounds
        // Base rect: (50,50) to (130,130), with buffer: (40,40) to (140,140)
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

  describe('Event-based timing support', () => {
    it('should handle click-based set animations (conservative approach)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="60" height="60" fill="red">
    <set attributeName="display" to="none" begin="click" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-click-timing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Conservative approach: include both elements since click could happen or not
        // Combined bounds: (50,50) to (260,260), with buffer: (40,40) to (270,270)
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(230) // 270 - 40
        expect(result.newViewBox.height).toBe(230)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle mouseover+offset timing', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="80" height="80" fill="blue" />
  <rect x="200" y="200" width="60" height="60" fill="red" opacity="0">
    <set attributeName="opacity" to="1" begin="mouseover+0.5s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-mouseover-offset.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Conservative: include both since mouseover event could make red rect visible
        expect(result.elements.count).toBe(2)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(230)
        expect(result.newViewBox.height).toBe(230)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Expanded set element support', () => {
    it('should handle set on geometric attributes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="60" height="60" fill="blue">
    <set attributeName="x" to="200" begin="1s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-geometric.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should consider both original position (100,100) and set position (200,100)
        // Combined bounds: (100,100) to (260,160), with buffer: (90,90) to (270,170)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(90)
        expect(result.newViewBox.y).toBe(90)
        expect(result.newViewBox.width).toBe(180) // 270 - 90
        expect(result.newViewBox.height).toBe(80) // 170 - 90
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle set on stroke-width', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="100" y="100" width="60" height="60" fill="none" stroke="black" stroke-width="2">
    <set attributeName="stroke-width" to="16" begin="2s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-set-stroke-width.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should consider both stroke-width values: 2 and 16
        // Max stroke extends bounds by 8 (half of 16) on each side
        // Base rect: (100,100) to (160,160)
        // With max stroke: (92,92) to (168,168)
        // With buffer: (82,82) to (178,178)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(82)
        expect(result.newViewBox.y).toBe(82)
        expect(result.newViewBox.width).toBe(96) // 178 - 82
        expect(result.newViewBox.height).toBe(96)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('calcMode support', () => {
    it('should handle calcMode="paced" (basic implementation)', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" values="50;150;100" calcMode="paced" dur="3s" begin="0s" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-calcmode-paced.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should include all x positions: 50, 150, 100
        // Bounds: (50,50) to (210,110), with buffer: (40,40) to (220,120)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40) // min(50,150,100) - 10
        expect(result.newViewBox.y).toBe(40) // 50 - 10
        expect(result.newViewBox.width).toBe(180) // (max_x + width + buffer) - min_x = (150+60+10) - 40
        expect(result.newViewBox.height).toBe(80) // (y + height + buffer) - min_y = (50+60+10) - 40
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Complex scenarios', () => {
    it('should handle multiple animation types on same element', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="20" fill="blue" stroke="red" stroke-width="2">
    <animate attributeName="cx" values="100;200" dur="2s" begin="0s" />
    <animate attributeName="r" values="20;40" dur="2s" begin="0s" />
    <set attributeName="stroke-width" to="10" begin="1s" />
  </circle>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-multiple-animations.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should consider:
        // - cx animation: 100 to 200
        // - r animation: 20 to 40
        // - stroke-width set: 2 to 10 (max stroke extends by 5)
        // Max bounds: cx=200, r=40, stroke=5 -> (200-40-5, 100-40-5) to (200+40+5, 100+40+5)
        // = (155, 55) to (245, 145), with buffer: (145, 45) to (255, 155)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(45) // min(100,200) - max_r - max_half_stroke - buffer = 100-40-5-10
        expect(result.newViewBox.y).toBe(45) // cy - max_r - max_half_stroke - buffer = 100-40-5-10
        expect(result.newViewBox.width).toBe(210) // (max_cx + max_r + max_half_stroke + buffer) - min_x = (200+40+5+10) - 45
        expect(result.newViewBox.height).toBe(110) // (cy + max_r + max_half_stroke + buffer) - min_y = (100+40+5+10) - 45
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle mixed timing modes', async () => {
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="60" height="60" fill="blue">
    <animate attributeName="x" values="50;100" dur="1s" begin="0s" />
    <set attributeName="y" to="150" begin="click" />
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-smil-mixed-timing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should consider:
        // - x animation: 50 to 100
        // - y set on click: could be 50 (original) or 150 (after click)
        // Combined bounds: (50,50) to (160,210), with buffer: (40,40) to (170,220)
        expect(result.elements.count).toBe(1)
        expect(result.newViewBox.x).toBe(40)
        expect(result.newViewBox.y).toBe(40)
        expect(result.newViewBox.width).toBe(130) // 170 - 40
        expect(result.newViewBox.height).toBe(180) // 220 - 40
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

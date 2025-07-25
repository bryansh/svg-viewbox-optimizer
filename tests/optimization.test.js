const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('SVG Optimization', () => {
  const fixturesDir = path.join(__dirname, 'fixtures')

  describe('ViewBox calculations', () => {
    it('should optimize simple rectangle correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Simple rect at x=50, y=50, width=100, height=100
      // With 10px buffer: x=40, y=40, width=120, height=120
      expect(result.original.viewBox).toBe('0 0 200 200')
      expect(result.optimized.viewBox).toBe('40.00 40.00 120.00 120.00')
      expect(result.content.width).toBeCloseTo(100, 1)
      expect(result.content.height).toBeCloseTo(100, 1)
      expect(result.optimized.width).toBeCloseTo(120, 1)
      expect(result.optimized.height).toBeCloseTo(120, 1)
    })

    it('should handle animated elements correctly', async () => {
      const input = path.join(fixturesDir, 'animated-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Animated rect moves from x=50 to x=150 (50 + 100 translation)
      // So bounds should be x=50 to x=200 (150 + 50 width)
      // With 10px buffer: x=40, width=170, height=70 (rect is 50x50)
      expect(result.original.viewBox).toBe('0 0 300 300')
      // Allow small floating-point variations in animation bounds calculation
      const [x, y, width, height] = result.optimized.viewBox.split(' ').map(Number)
      expect(x).toBeCloseTo(40, 0) // Within 1 unit tolerance
      expect(y).toBeCloseTo(40, 1)
      expect(width).toBeCloseTo(170, 1)
      expect(height).toBeCloseTo(70, 1)
      expect(result.elements.animationCount).toBeGreaterThan(0)
    })

    it('should handle symbol/use patterns', async () => {
      const input = path.join(fixturesDir, 'symbol-use.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Use element at x=150, y=150 with 100x100 size
      // The star polygon within the symbol is offset by (10,10) and is 80x80
      // So final rendered bounds are (160,160) with 80x80 size
      // With 10px buffer: viewBox becomes (150,150) with 100x100 size
      expect(result.original.viewBox).toBe('0 0 400 400')
      expect(result.optimized.viewBox).toBe('150.00 150.00 100.00 100.00')
      expect(result.content.width).toBeCloseTo(80, 1)
      expect(result.content.height).toBeCloseTo(80, 1)
      expect(result.optimized.width).toBeCloseTo(100, 1)
      expect(result.optimized.height).toBeCloseTo(100, 1)
    })
  })

  describe('Space savings calculations', () => {
    it('should calculate space savings correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Original: 200x200 = 40,000 units²
      // New: 120x120 = 14,400 units²
      // Savings: (40,000 - 14,400) / 40,000 = 64%
      expect(result.original.area).toBe(40000)
      expect(result.optimized.area).toBe(14400)
      expect(result.savings.percentage).toBeCloseTo(64, 1)
      expect(result.savings.unitsSquared).toBe(25600)
    })

    it('should show significant savings for large empty areas', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      expect(result.savings.percentage).toBeGreaterThan(50) // Should save significant space
    })
  })

  describe('Buffer handling', () => {
    it('should apply buffer correctly', async () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')

      // Test with 0 buffer
      const result0 = await calculateOptimization(input, { buffer: 0 })
      expect(result0.optimized.viewBox).toBe('50.00 50.00 100.00 100.00')
      expect(result0.buffer).toBe(0)

      // Test with 20 buffer
      const result20 = await calculateOptimization(input, { buffer: 20 })
      expect(result20.optimized.viewBox).toBe('30.00 30.00 140.00 140.00')
      expect(result20.buffer).toBe(20)
    })

    it('should handle negative coordinates with buffer', async () => {
      // Create a test SVG with element at origin
      const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="0" y="0" width="50" height="50" fill="red" />
      </svg>`

      const tempFile = path.join(__dirname, 'temp-test.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })
        expect(result.optimized.viewBox).toBe('-10.00 -10.00 70.00 70.00')
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })

  describe('Animation support', () => {
    it('should handle animateMotion with path parsing', async () => {
      const input = path.join(fixturesDir, 'test-motion.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Test motion SVG has complex paths and motion animations
      expect(result.original.viewBox).toBe('0 0 400 400')
      expect(result.elements.count).toBe(4) // 1 use + 3 animated elements
      expect(result.elements.animationCount).toBe(3) // 3 animateMotion elements

      // Should optimize significantly from original 400x400
      expect(result.savings.percentage).toBeGreaterThan(25)

      // Bounds should capture all motion paths
      // Based on our test file: paths go from ~20,300 to ~350,350 with rotation buffer
      expect(result.content.minX).toBeLessThan(50)
      expect(result.content.maxX).toBeGreaterThan(300)
      expect(result.content.minY).toBeLessThan(150)
      expect(result.content.maxY).toBeGreaterThan(300)
    }, 60000) // 60 second timeout for complex animation tests

    it('should parse SVG path data correctly', async () => {
      const input = path.join(fixturesDir, 'test-motion.svg')
      const result = await calculateOptimization(input, { buffer: 10, debug: false })

      // Should find elements with motion animations
      const animatedElements = result.elements.details.filter(el => el.hasAnimations)
      expect(animatedElements).toHaveLength(3)

      // Should account for all animation types
      expect(result.elements.animationCount).toBe(3)
    }, 60000) // 60 second timeout for complex path parsing tests

    it('should handle mpath references', async () => {
      // Create a test SVG with mpath reference
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="curve" d="M 20,50 Q 100,20 180,50"/>
  </defs>
  <circle r="5" fill="red">
    <animateMotion dur="2s" repeatCount="indefinite">
      <mpath href="#curve"/>
    </animateMotion>
  </circle>
</svg>`

      const tempFile = path.join(__dirname, 'temp-mpath.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect motion animation and optimize around the curve
        expect(result.elements.animationCount).toBe(1)
        expect(result.savings.percentage).toBeGreaterThan(0)

        // Bounds should capture the quadratic curve from 20,50 to 180,50
        expect(result.content.minX).toBeLessThan(25)
        expect(result.content.maxX).toBeGreaterThan(175)
      } finally {
        fs.unlinkSync(tempFile)
      }
    }, 60000) // 60 second timeout for mpath reference tests

    it('should handle coordinate-based motion values', async () => {
      // Create a test SVG with values-based motion
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="10" height="10" fill="blue">
    <animateMotion dur="3s" values="50,100; 100,50; 150,100; 200,50; 250,100"/>
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-values.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect motion animation
        expect(result.elements.animationCount).toBe(1)

        // Bounds should capture motion from x=50 to x=260 (250+10), y=50 to y=110 (100+10)
        expect(result.content.minX).toBeLessThan(55)
        expect(result.content.maxX).toBeGreaterThan(255)
        expect(result.content.minY).toBeLessThan(55)
        expect(result.content.maxY).toBeGreaterThan(105)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle path morphing animations (d attribute)', async () => {
      const input = path.join(fixturesDir, 'test-path-morphing.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Test path morphing SVG has 4 paths with d attribute animations
      expect(result.original.viewBox).toBe('0 0 300 300')
      expect(result.elements.count).toBe(4) // 4 path elements
      expect(result.elements.animationCount).toBe(4) // 4 d attribute animations

      // Should optimize from original 300x300
      expect(result.savings.percentage).toBeGreaterThan(10)

      // Bounds should capture all morphing states
      // Based on our test file: morphs include shapes from x=50 to x=290, y=0 to y=280
      expect(result.content.minX).toBeLessThan(60)
      expect(result.content.maxX).toBeGreaterThan(280)
      expect(result.content.minY).toBeLessThan(10)
      expect(result.content.maxY).toBeGreaterThan(270)
    })

    it('should parse path data in animate elements', async () => {
      // Create a test SVG with simple path morphing
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <path fill="red">
    <animate attributeName="d" dur="2s"
             values="M 50,50 L 100,50 L 100,100 L 50,100 Z;
                     M 60,60 L 90,60 L 90,90 L 60,90 Z;
                     M 50,50 L 100,50 L 100,100 L 50,100 Z"/>
  </path>
</svg>`

      const tempFile = path.join(__dirname, 'temp-path-morphing.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect path morphing animation
        expect(result.elements.animationCount).toBe(1)

        // Bounds should capture all morphing states (square from 50,50 to 100,100)
        expect(result.content.minX).toBeLessThan(55)
        expect(result.content.maxX).toBeGreaterThan(95)
        expect(result.content.minY).toBeLessThan(55)
        expect(result.content.maxY).toBeGreaterThan(95)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle stroke-only animated paths', async () => {
      // Create a test SVG with stroke-only path animation
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
  <path fill="none" stroke="blue" stroke-width="2">
    <animate attributeName="d" dur="1s"
             values="M 20,20 L 80,20;
                     M 20,20 Q 50,10 80,20;
                     M 20,20 L 80,20"/>
  </path>
</svg>`

      const tempFile = path.join(__dirname, 'temp-stroke-path.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect stroke-only path animation (regression test for getBBox filtering)
        expect(result.elements.count).toBe(1)
        expect(result.elements.animationCount).toBe(1)

        // Should optimize space by detecting actual animated bounds
        expect(result.savings.percentage).toBeGreaterThan(50)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle overlapping additive animations', async () => {
      const input = path.join(fixturesDir, 'test-simple-overlap.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Simple overlap SVG has translate + rotate additive animations
      expect(result.original.viewBox).toBe('0 0 200 200')
      expect(result.elements.count).toBe(1) // 1 rect
      expect(result.elements.animationCount).toBe(2) // 2 overlapping animations

      // Should achieve reasonable savings by combining animations properly
      expect(result.savings.percentage).toBeGreaterThan(20)
      expect(result.savings.percentage).toBeLessThan(50) // Not too optimistic

      // Bounds should reflect combined animation states, not individual extremes
      expect(result.content.width).toBeLessThan(180) // Combined should be more efficient than separate
      expect(result.content.height).toBeLessThan(200)
    })

    it('should handle complex nested transforms', async () => {
      const input = path.join(fixturesDir, 'test-complex-transforms.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Complex transforms SVG has nested groups and multiple animation types
      expect(result.original.viewBox).toBe('0 0 500 500')
      expect(result.elements.count).toBeGreaterThan(10) // Multiple elements
      expect(result.elements.animationCount).toBeGreaterThan(10) // Multiple animations

      // Should detect all animation types including matrix
      const animatedElements = result.elements.details.filter(el => el.hasAnimations)
      expect(animatedElements.length).toBeGreaterThan(8)
    })

    it('should support matrix transforms', async () => {
      // Create a test SVG with matrix transform animation
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="20" width="20" height="20" fill="blue">
    <animateTransform attributeName="transform" type="matrix"
                     values="1,0,0,1,0,0; 1.5,0,0,1.5,10,10; 1,0,0,1,0,0"
                     dur="2s" repeatCount="indefinite"/>
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-matrix.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect matrix transform animation
        expect(result.elements.animationCount).toBe(1)

        // Should handle matrix transforms without errors
        expect(result.savings.percentage).toBeGreaterThan(0)
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle event-triggered animations', async () => {
      const input = path.join(fixturesDir, 'test-event-animations.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Should detect all animations regardless of trigger
      expect(result.elements.animationCount).toBe(4) // 4 animations total

      // Bounds should include potential animation states
      // Rectangle can translate 100px right
      expect(result.content.maxX).toBeGreaterThan(200) // 50 + 60 + 100 = 210

      // Circle can expand to r=50
      expect(result.content.width).toBeGreaterThan(150) // Should include expanded circle

      // Event-triggered animations can expand bounds beyond original viewBox
      // This is expected behavior - we include all potential animation states
      expect(result.original.viewBox).toBe('0 0 300 300')
      expect(result.content.width).toBeGreaterThan(300) // Animations expand beyond original
    })

    it('should handle various event timing types', async () => {
      const input = path.join(fixturesDir, 'test-event-types.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Should detect all animations regardless of event type
      expect(result.elements.animationCount).toBe(7) // 7 animations total

      // Verify bounds include all animation possibilities
      // Rectangle width animation: 10+60=70
      expect(result.content.maxX).toBeGreaterThan(65)

      // Circle radius animation: 100+35=135
      expect(result.content.maxX).toBeGreaterThan(130)

      // Animation chaining (anim1.end trigger) should work
      expect(result.content.width).toBeGreaterThan(100) // Includes chained animation bounds
    })

    it('should handle chained symbol references', async () => {
      const input = path.join(fixturesDir, 'test-symbol-chains.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Should detect all resolved elements from the chain
      expect(result.elements.count).toBeGreaterThan(5) // Multiple elements resolved from chains

      // Should resolve and find actual content (not just empty bounds)
      expect(result.content.width).toBeGreaterThan(200) // Should find real content with proper positioning
      expect(result.content.height).toBeGreaterThan(200)

      // Should optimize from original 400x400
      expect(result.original.viewBox).toBe('0 0 400 400')
      expect(result.savings.percentage).toBeGreaterThan(0)

      // Root-level use positioning should now be properly applied
      // First use: <use href="#icon3" x="100" y="100" width="200" height="200"/>
      // Should position content starting around x=100, y=100
      expect(result.content.minX).toBeGreaterThan(50) // Should be positioned, not at origin
      expect(result.content.minY).toBeGreaterThan(90) // Should be positioned, not at origin

      // Second use: <use href="#icon2" x="50" y="250" width="100" height="100"/>
      // Should extend bounds to include this positioned content
      expect(result.content.maxY).toBeGreaterThan(300) // Should include second use at y=250
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle complex weather icon', async () => {
      const weatherIcon = path.join(__dirname, '..', 'thunderstorms-overcast.svg')

      if (fs.existsSync(weatherIcon)) {
        const result = await calculateOptimization(weatherIcon, { buffer: 10 })

        expect(result.original.viewBox).toBe('0 0 512 512')
        expect(result.optimized.viewBox).toBe('43.54 138.08 441.66 340.82')
        expect(result.elements.count).toBe(3)
        expect(result.elements.animationCount).toBe(2)
        expect(result.savings.percentage).toBeCloseTo(42.6, 1)
      }
    })

    it('should handle test animations', async () => {
      const testAnimations = path.join(__dirname, '..', 'test-animations.svg')

      if (fs.existsSync(testAnimations)) {
        const result = await calculateOptimization(testAnimations, { buffer: 10 })

        expect(result.original.viewBox).toBe('0 0 400 400')
        expect(result.elements.count).toBe(7)
        expect(result.elements.animationCount).toBeGreaterThan(0)
      }
    })

    it('should handle filter effects correctly', async () => {
      const input = path.join(fixturesDir, 'test-filters.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Test filters SVG has 4 elements with various filter effects
      expect(result.original.viewBox).toBe('0 0 300 300')
      expect(result.elements.count).toBe(4)
      expect(result.elements.effectsCount).toBe(4) // All 4 elements have filters

      // Should expand bounds due to filter effects
      // The simple rect at (50,50) 40x40 with blur should expand beyond its static bounds
      expect(result.content.minX).toBeLessThan(45) // Blur should expand left
      expect(result.content.minY).toBeLessThan(45) // Blur should expand up
      expect(result.content.maxX).toBeGreaterThan(95) // Blur should expand right
      expect(result.content.maxY).toBeGreaterThan(95) // Blur should expand down

      // Should still achieve some optimization
      expect(result.savings.percentage).toBeGreaterThan(10)
    })

    it('should handle mask and clipPath effects', async () => {
      const input = path.join(fixturesDir, 'test-mask-clippath.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Test mask/clippath SVG has 4 elements with various effects
      expect(result.original.viewBox).toBe('0 0 250 250')
      expect(result.elements.count).toBe(4)
      expect(result.elements.effectsCount).toBe(4) // All elements have mask, clipPath, or both

      // For mask and clipPath, we preserve full element bounds for safety
      // So bounds should include full elements even if visually clipped
      expect(result.content.minX).toBeLessThan(55) // Should include full rect bounds
      expect(result.content.maxX).toBeGreaterThan(190) // Should include rightmost elements

      // Should still achieve optimization from original 250x250
      expect(result.savings.percentage).toBeGreaterThan(15)
    })

    it('should handle combined filter and animation effects', async () => {
      // Create a test SVG with both animation and filter
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <rect x="50" y="50" width="30" height="30" fill="blue" filter="url(#glow)">
    <animateTransform attributeName="transform" type="translate" 
                     values="0,0; 50,0; 0,0" dur="2s" repeatCount="indefinite"/>
  </rect>
</svg>`

      const tempFile = path.join(__dirname, 'temp-filter-animation.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect both animation and filter
        expect(result.elements.animationCount).toBe(1)
        expect(result.elements.effectsCount).toBe(1)

        // Should account for both animation translation and filter expansion
        // Animation moves rect from x=50 to x=100, filter expands bounds further
        expect(result.content.minX).toBeLessThan(45) // Filter expansion
        expect(result.content.maxX).toBeGreaterThan(135) // Animation + filter
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle CSS filter functions', async () => {
      // Create a test SVG with CSS filter functions
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="30" height="30" fill="red" style="filter: blur(6px)"/>
  <circle cx="100" cy="100" r="15" fill="green" style="filter: drop-shadow(8px 8px 4px rgba(0,0,0,0.5))"/>
</svg>`

      const tempFile = path.join(__dirname, 'temp-css-filters.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect CSS filters as effects
        expect(result.elements.effectsCount).toBe(2)

        // Should expand bounds for CSS blur and drop-shadow
        expect(result.content.minX).toBeLessThan(35) // Blur expansion
        expect(result.content.maxX).toBeGreaterThan(120) // Drop shadow expansion
      } finally {
        fs.unlinkSync(tempFile)
      }
    })

    it('should handle foreignObject elements', async () => {
      const input = path.join(fixturesDir, 'test-foreign-object.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      // Test foreign object SVG has 4 visual elements (3 foreignObject + 1 rect)
      expect(result.original.viewBox).toBe('0 0 400 400')
      expect(result.elements.count).toBe(4)
      expect(result.elements.animationCount).toBe(1) // One animated foreignObject

      // Should include all foreignObject bounds:
      // - First at (50,50) with 100x80
      // - Second at (200,100) translated by (20,30) = (220,130) with 120x60
      // - Third at (50,200) animates to (150,200) with 80x80
      // - Rect at (250,250) with 50x50
      expect(result.content.minX).toBeLessThan(55) // First foreignObject
      expect(result.content.maxX).toBeGreaterThan(335) // Second foreignObject at 220+120=340

      // Should achieve optimization from original 400x400
      expect(result.savings.percentage).toBeGreaterThan(25)
    })

    it('should handle foreignObject with filters', async () => {
      // Create a test SVG with foreignObject and filter
      const testSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blur">
      <feGaussianBlur stdDeviation="5"/>
    </filter>
  </defs>
  <foreignObject x="50" y="50" width="60" height="40" filter="url(#blur)">
    <div xmlns="http://www.w3.org/1999/xhtml">Blurred HTML</div>
  </foreignObject>
</svg>`

      const tempFile = path.join(__dirname, 'temp-foreign-filter.svg')
      fs.writeFileSync(tempFile, testSvg)

      try {
        const result = await calculateOptimization(tempFile, { buffer: 10 })

        // Should detect both foreignObject and filter effect
        expect(result.elements.count).toBe(1)
        expect(result.elements.effectsCount).toBe(1)

        // Should expand bounds for blur filter
        expect(result.content.minX).toBeLessThan(45) // 50 - blur expansion
        expect(result.content.maxX).toBeGreaterThan(115) // 50+60 + blur expansion
      } finally {
        fs.unlinkSync(tempFile)
      }
    })
  })
})

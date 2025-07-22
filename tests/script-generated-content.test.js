const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('Script-Generated Dynamic DOM Content', () => {
  let tempFiles = []

  afterEach(() => {
    // Clean up temporary files
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    })
    tempFiles = []
  })

  const createTempFile = (content) => {
    const tempFile = path.join(__dirname, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`)
    fs.writeFileSync(tempFile, content)
    tempFiles.push(tempFile)
    return tempFile
  }

  describe('Basic script-generated content', () => {
    it('should capture immediately added script content', async () => {
      const immediateSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <rect x="50" y="50" width="50" height="50" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      // Add content immediately (synchronously)
      const svg = document.querySelector('svg');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '200');
      circle.setAttribute('cy', '200');
      circle.setAttribute('r', '40');
      circle.setAttribute('fill', 'red');
      svg.appendChild(circle);
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(immediateSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 0 // No delay needed for synchronous content
      })

      // Should capture both static rect and script-added circle
      expect(result.elements.count).toBe(2)
      expect(result.content.width).toBeGreaterThanOrEqual(190) // From 50 to 240
      expect(result.content.height).toBeGreaterThanOrEqual(190)
    })

    it('should capture content added after short delay', async () => {
      const delayedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect x="50" y="50" width="50" height="50" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      setTimeout(function() {
        const svg = document.querySelector('svg');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '250');
        rect.setAttribute('y', '250');
        rect.setAttribute('width', '100');
        rect.setAttribute('height', '100');
        rect.setAttribute('fill', 'green');
        svg.appendChild(rect);
      }, 200);
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(delayedSvg)

      // Without script delay - might still catch some delayed content due to page load timing
      const resultNoDelay = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 0
      })
      // May capture 1 or 2 elements depending on timing
      expect(resultNoDelay.elements.count).toBeGreaterThanOrEqual(1)
      expect(resultNoDelay.elements.count).toBeLessThanOrEqual(2)

      // With sufficient script delay - should capture the delayed content
      const resultWithDelay = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 300
      })
      expect(resultWithDelay.elements.count).toBe(2)
      expect(resultWithDelay.content.width).toBeGreaterThanOrEqual(300) // From 50 to 350
    })
  })

  describe('Complex script-generated scenarios', () => {
    it('should handle multiple delayed content additions', async () => {
      const multiDelayedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500">
  <circle cx="100" cy="100" r="30" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      const svg = document.querySelector('svg');
      
      // Add content at different times
      setTimeout(() => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '200');
        rect.setAttribute('y', '200');
        rect.setAttribute('width', '50');
        rect.setAttribute('height', '50');
        rect.setAttribute('fill', 'red');
        svg.appendChild(rect);
      }, 100);
      
      setTimeout(() => {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        ellipse.setAttribute('cx', '400');
        ellipse.setAttribute('cy', '400');
        ellipse.setAttribute('rx', '60');
        ellipse.setAttribute('ry', '40');
        ellipse.setAttribute('fill', 'green');
        svg.appendChild(ellipse);
      }, 300);
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(multiDelayedSvg)

      // Test different delay values - use shorter delays for CI
      const mediumDelay = process.env.CI ? 50 : 150
      const longDelay = process.env.CI ? 120 : 400

      const resultMedium = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: mediumDelay
      })
      // Should have at least 2 elements (initial + maybe first delayed)
      expect(resultMedium.elements.count).toBeGreaterThanOrEqual(2)

      const resultLong = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: longDelay
      })
      expect(resultLong.elements.count).toBe(3) // Initial + both delayed
      expect(resultLong.content.width).toBeGreaterThanOrEqual(360) // From 70 to 460
    })

    it('should handle script-generated groups and transforms', async () => {
      const complexScriptSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect x="50" y="50" width="50" height="50" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      setTimeout(() => {
        const svg = document.querySelector('svg');
        
        // Create a group with transform
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'translate(200, 200) rotate(45)');
        
        // Add content to the group
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '-25');
        rect.setAttribute('y', '-25');
        rect.setAttribute('width', '50');
        rect.setAttribute('height', '50');
        rect.setAttribute('fill', 'orange');
        
        g.appendChild(rect);
        svg.appendChild(g);
      }, 200);
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(complexScriptSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 300
      })

      // Should include the transformed group
      expect(result.elements.count).toBeGreaterThanOrEqual(2)
      // The rotated square at (200,200) extends the bounds
      expect(result.content.width).toBeGreaterThanOrEqual(180)
      expect(result.content.height).toBeGreaterThanOrEqual(180)
    })
  })

  describe('Script delay configuration', () => {
    it('should respect scriptDelay option', async () => {
      const timedSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
  <rect x="50" y="50" width="50" height="50" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      // Add elements at specific times
      const svg = document.querySelector('svg');
      const times = [100, 200, 300, 400, 500];
      times.forEach((time, index) => {
        setTimeout(() => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', 100 + index * 30);
          circle.setAttribute('cy', 200);
          circle.setAttribute('r', '10');
          circle.setAttribute('fill', 'red');
          svg.appendChild(circle);
        }, time);
      });
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(timedSvg)

      // Test that longer delays capture more content
      const result0 = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 0
      })

      // Use shorter delay for CI compatibility
      const longDelay = process.env.CI ? 150 : 600
      const resultLong = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: longDelay
      })

      // With longer delay should capture at least as many elements (or more)
      expect(resultLong.elements.count).toBeGreaterThanOrEqual(result0.elements.count)
    })

    it('should work with zero script delay (default)', async () => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
</svg>`

      const tempFile = createTempFile(svg)

      // Default behavior - no script delay
      const result = await calculateOptimization(tempFile, { buffer: 10 })
      expect(result.elements.count).toBe(1)

      // Explicit zero delay should be the same
      const resultZero = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 0
      })
      expect(resultZero.elements.count).toBe(1)
    })
  })

  describe('Edge cases and limitations', () => {
    it('should handle scripts that fail', async () => {
      const errorScriptSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
  <script type="text/javascript">
    <![CDATA[
      // This will throw an error
      setTimeout(() => {
        nonExistentFunction(); // Will cause an error
        
        // This won't execute
        const svg = document.querySelector('svg');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '150');
        circle.setAttribute('cy', '150');
        circle.setAttribute('r', '30');
        svg.appendChild(circle);
      }, 100);
    ]]>
  </script>
</svg>`

      const tempFile = createTempFile(errorScriptSvg)

      // Should still process successfully, just without the failed dynamic content
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: 200
      })
      expect(result.elements.count).toBe(1) // Only the static rect
    })

    it('should handle script delays gracefully', async () => {
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect x="50" y="50" width="100" height="100" fill="blue"/>
</svg>`

      const tempFile = createTempFile(svg)

      // Use shorter delay for CI compatibility (50ms)
      const delay = process.env.CI ? 50 : 3000
      const startTime = Date.now()
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        scriptDelay: delay
      })
      const duration = Date.now() - startTime

      expect(result.elements.count).toBe(1)
      expect(duration).toBeGreaterThanOrEqual(delay)
      // Allow reasonable overhead based on delay length
      const maxDuration = process.env.CI ? 2000 : 8000
      expect(duration).toBeLessThan(maxDuration)
    })
  })
})

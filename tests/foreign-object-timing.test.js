const fs = require('fs')
const path = require('path')
const { calculateOptimization } = require('../viewbox-calculator')

describe('ForeignObject HTML Layout Timing', () => {
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

  describe('HTML Content Layout Issues', () => {
    it('should handle foreignObject with complex HTML content', async () => {
      const complexHtmlSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <foreignObject x="50" y="50" width="300" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="
      font-family: Arial, sans-serif; 
      padding: 20px; 
      background: linear-gradient(45deg, #f0f0f0, #e0e0e0);
      border-radius: 10px;
      box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
    ">
      <h2 style="color: #333; margin-top: 0;">Dynamic Content</h2>
      <p style="line-height: 1.6; color: #666;">
        This HTML content may have different layout characteristics
        than the declared width and height attributes.
      </p>
      <div style="display: flex; justify-content: space-between; margin-top: 15px;">
        <button style="padding: 8px 16px; background: #007cba; color: white; border: none; border-radius: 4px;">
          Click Me
        </button>
        <div style="display: flex; flex-direction: column; text-align: right;">
          <span style="font-size: 0.9em; color: #888;">Status:</span>
          <span style="font-weight: bold; color: #2d5aa0;">Active</span>
        </div>
      </div>
    </div>
  </foreignObject>
</svg>`

      const tempFile = createTempFile(complexHtmlSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        // Add longer timeout for HTML layout
        browserTimeout: 10000,
        // Enable debug to see timing
        debug: false
      })

      // Should detect actual HTML content size (which may be larger than declared)
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeGreaterThanOrEqual(300) // At least declared width
      expect(result.content.height).toBeGreaterThanOrEqual(200) // At least declared height
    })

    it('should handle foreignObject with images that need to load', async () => {
      const imageHtmlSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <foreignObject x="100" y="100" width="200" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="padding: 10px;">
      <h3>Image Gallery</h3>
      <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyODVmNCIvPgogIDx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VGVzdCBJbWFnZTwvdGV4dD4KPC9zdmc+" 
           alt="Test Image" style="width: 80px; height: 80px; display: block; margin: 10px auto;" />
      <p style="text-align: center; margin: 5px 0;">Sample Image</p>
    </div>
  </foreignObject>
</svg>`

      const tempFile = createTempFile(imageHtmlSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        browserTimeout: 8000 // Give time for image to load
      })

      // Should handle the foreign object despite embedded images
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeGreaterThanOrEqual(200) // At least declared width
      expect(result.content.height).toBeGreaterThanOrEqual(150) // At least declared height
    })

    it('should handle foreignObject with CSS that affects layout', async () => {
      const cssLayoutSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 300">
  <foreignObject x="50" y="50" width="250" height="180">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>
        .container { 
          width: 100%; 
          height: 100%; 
          display: flex; 
          flex-direction: column; 
          justify-content: center;
          align-items: center;
          background: #f8f9fa;
          border: 2px solid #dee2e6;
          box-sizing: border-box;
        }
        .title { 
          font-size: 24px; 
          font-weight: bold; 
          color: #343a40;
          margin-bottom: 20px;
        }
        .content { 
          max-width: 80%; 
          text-align: center;
          line-height: 1.5;
        }
        @media (max-width: 300px) {
          .title { font-size: 18px; }
        }
      </style>
      <div class="container">
        <div class="title">CSS Layout</div>
        <div class="content">
          This content uses CSS flexbox and media queries
          that might affect the final layout dimensions.
        </div>
      </div>
    </div>
  </foreignObject>
</svg>`

      const tempFile = createTempFile(cssLayoutSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        browserTimeout: 6000 // Give time for CSS to apply
      })

      // Should detect actual layout dimensions (may be larger than declared)
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeGreaterThanOrEqual(250) // At least declared width
      expect(result.content.height).toBeGreaterThanOrEqual(180) // At least declared height
    })
  })

  describe('Layout Timing Edge Cases', () => {
    it('should handle foreignObject with web fonts in HTML content', async () => {
      const webFontSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <foreignObject x="75" y="75" width="250" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet" />
      <div style="
        font-family: 'Roboto', sans-serif; 
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">
        <h3 style="font-weight: 700; margin-top: 0; color: #2c3e50;">
          Web Font Content
        </h3>
        <p style="font-weight: 300; line-height: 1.6; color: #7f8c8d;">
          This text uses web fonts that need to be loaded,
          which could affect layout timing and measurements.
        </p>
      </div>
    </div>
  </foreignObject>
</svg>`

      const tempFile = createTempFile(webFontSvg)
      const result = await calculateOptimization(tempFile, {
        buffer: 10,
        browserTimeout: 12000, // Extended timeout for font loading
        fontTimeoutMs: 8000 // Also set font-specific timeout
      })

      // Should handle web font loading within foreignObject
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeGreaterThanOrEqual(250) // At least declared width
      expect(result.content.height).toBeGreaterThanOrEqual(150) // At least declared height
    })

    it('should handle empty foreignObject gracefully', async () => {
      const emptySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <foreignObject x="50" y="50" width="100" height="100">
    <div xmlns="http://www.w3.org/1999/xhtml" style="background: transparent;">
      <!-- Empty content -->
    </div>
  </foreignObject>
</svg>`

      const tempFile = createTempFile(emptySvg)
      const result = await calculateOptimization(tempFile, { buffer: 10 })

      // Should still respect declared dimensions even when empty
      expect(result.elements.count).toBe(1)
      expect(result.content.width).toBeCloseTo(100, 1)
      expect(result.content.height).toBeCloseTo(100, 1)
    })
  })
})

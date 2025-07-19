const fs = require('fs')
const puppeteer = require('puppeteer')

async function instantiateBrowser () {
  let browser

  // Launch headless browser
  try {
    browser = await puppeteer.launch({ headless: 'new' })
  } catch (error) {
    // Fallback for restricted environments (Docker, CI/CD, etc.)
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }

  return browser
}

async function calculateOptimization (inputFile, options = {}) {
  const browser = await instantiateBrowser()

  try {
    const svgContent = fs.readFileSync(inputFile, 'utf8')
    const buffer = options.buffer !== undefined ? parseInt(options.buffer) : 10

    const page = await browser.newPage()

    // For now, let's use a simpler approach that still removes hardcoded logic
    // but works within the browser context without complex module loading

    // Capture console output
    if (options.debug) {
      page.on('console', msg => console.log('Browser console:', msg.text()))
    }

    // Create HTML page with the SVG
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        ${svgContent}
      </body>
      </html>
    `

    await page.setContent(html)

    // Calculate bounds using the new modular architecture
    const bounds = await page.evaluate((debugMode) => {
      const debug = debugMode
      const svg = document.querySelector('svg')

      if (!svg) {
        throw new Error('No SVG found')
      }

      // Get original viewBox
      const originalViewBox = svg.getAttribute('viewBox')

      if (!originalViewBox) {
        return { error: 'No viewBox attribute found. Please add a viewBox to your SVG.' }
      }

      const [, , origWidth, origHeight] = originalViewBox.split(' ').map(Number)

      if (debug) {
        console.log('=== SVG ViewBox Optimization (Generic Architecture) ===')
        console.log(`Original viewBox: ${originalViewBox}`)
      }

      // Generic container detection - no hardcoded logic
      function isContainerSymbol (symbolElement) {
        const nestedUseElements = symbolElement.querySelectorAll('use')
        return nestedUseElements.length > 0
      }

      function shouldIncludeElement (element) {
        // Skip elements inside defs or symbol definitions
        let parent = element.parentElement
        while (parent && parent !== svg) {
          const tagName = parent.tagName.toLowerCase()
          if (tagName === 'defs' || tagName === 'symbol') {
            return false
          }
          parent = parent.parentElement
        }
        return true
      }

      // Generic transform parsing (handles translate, scale, rotate)
      function parseTransformValues (transformString) {
        if (!transformString) return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }

        const result = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }

        // Parse translate
        const translateMatch = transformString.match(/translate\(([^)]+)\)/)
        if (translateMatch) {
          const values = translateMatch[1].split(/[,\s]+/).map(v => parseFloat(v.trim()))
          result.x = values[0] || 0
          result.y = values[1] || 0
        }

        // Parse scale
        const scaleMatch = transformString.match(/scale\(([^)]+)\)/)
        if (scaleMatch) {
          const values = scaleMatch[1].split(/[,\s]+/).map(v => parseFloat(v.trim()))
          result.scaleX = values[0] || 1
          result.scaleY = values[1] || values[0] || 1
        }

        // Parse rotate
        const rotateMatch = transformString.match(/rotate\(([^)]+)\)/)
        if (rotateMatch) {
          const values = rotateMatch[1].split(/[,\s]+/).map(v => parseFloat(v.trim()))
          result.rotation = values[0] || 0
        }

        return result
      }

      // Generic animation analysis
      function analyzeElementAnimations (element) {
        const animations = []
        const animatedElements = svg.querySelectorAll('animateTransform')

        animatedElements.forEach(anim => {
          if (anim.parentElement === element) {
            const values = anim.getAttribute('values')
            const type = anim.getAttribute('type')

            if (type === 'translate' && values) {
              const translateValues = values.split(';').map(v => {
                const [x, y] = v.trim().split(/\s+/).map(Number)
                return { x: x || 0, y: y || 0 }
              })

              const minTransX = Math.min(...translateValues.map(t => t.x))
              const maxTransX = Math.max(...translateValues.map(t => t.x))
              const minTransY = Math.min(...translateValues.map(t => t.y))
              const maxTransY = Math.max(...translateValues.map(t => t.y))

              animations.push({ minTransX, maxTransX, minTransY, maxTransY })
            }
          }
        })

        return animations
      }

      // Calculate bounds for all relevant elements
      const elementBounds = []

      // Process use elements
      const useElements = svg.querySelectorAll('use')
      if (debug) {
        console.log(`Processing ${useElements.length} use elements`)
      }

      useElements.forEach(useEl => {
        if (!shouldIncludeElement(useEl)) return

        const href = useEl.getAttribute('xlink:href') || useEl.getAttribute('href')
        if (!href || !href.startsWith('#')) return

        const referencedSymbol = svg.querySelector(href)
        if (!referencedSymbol) return

        // Handle container symbols by processing their child use elements
        if (isContainerSymbol(referencedSymbol)) {
          if (debug) {
            console.log(`  Processing container symbol ${href} - expanding children`)
          }

          // Get the transform for the container use element
          const containerTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
          let currentEl = useEl

          while (currentEl && currentEl !== svg) {
            const transform = currentEl.getAttribute('transform')
            if (transform) {
              const parsed = parseTransformValues(transform)
              containerTransform.x += parsed.x
              containerTransform.y += parsed.y
              containerTransform.scaleX *= parsed.scaleX
              containerTransform.scaleY *= parsed.scaleY
              containerTransform.rotation += parsed.rotation
            }
            currentEl = currentEl.parentElement
          }

          // Process each child use element in the container
          const childUseElements = referencedSymbol.querySelectorAll('use')
          childUseElements.forEach(childUse => {
            const childHref = childUse.getAttribute('xlink:href') || childUse.getAttribute('href')
            if (!childHref || !childHref.startsWith('#')) return

            const childReferencedSymbol = svg.querySelector(childHref)
            if (!childReferencedSymbol || isContainerSymbol(childReferencedSymbol)) return

            const childBbox = childUse.getBBox()
            if (!childBbox || childBbox.width <= 0 || childBbox.height <= 0) return

            // Get child's transform
            const childTransform = parseTransformValues(childUse.getAttribute('transform'))

            // Combine container and child transforms
            let finalX = childBbox.x + containerTransform.x + childTransform.x
            let finalY = childBbox.y + containerTransform.y + childTransform.y
            let finalWidth = childBbox.width * containerTransform.scaleX * childTransform.scaleX
            let finalHeight = childBbox.height * containerTransform.scaleY * childTransform.scaleY

            // Handle rotation (simplified)
            const totalRotation = containerTransform.rotation + childTransform.rotation
            if (totalRotation !== 0) {
              const diagonal = Math.sqrt(finalWidth * finalWidth + finalHeight * finalHeight)
              const centerX = finalX + finalWidth / 2
              const centerY = finalY + finalHeight / 2
              finalX = centerX - diagonal / 2
              finalY = centerY - diagonal / 2
              finalWidth = diagonal
              finalHeight = diagonal
            }

            // Analyze animations on the child element
            const animations = analyzeElementAnimations(childUse)

            if (debug) {
              console.log(`    ${childHref}: bounds (${finalX.toFixed(2)}, ${finalY.toFixed(2)}) ${finalWidth.toFixed(2)}x${finalHeight.toFixed(2)}, ${animations.length} animations`)
            }

            elementBounds.push({
              element: childUse,
              bounds: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
              hasAnimations: animations.length > 0,
              animationCount: animations.length,
              animations
            })
          })

          return // Skip processing the container use element itself
        }

        if (debug) {
          console.log(`  Processing use element ${href}`)
        }

        const bbox = useEl.getBBox()
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return

        // Calculate cumulative transforms
        const totalTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }
        let currentEl = useEl

        while (currentEl && currentEl !== svg) {
          const transform = currentEl.getAttribute('transform')
          if (transform) {
            const parsed = parseTransformValues(transform)
            totalTransform.x += parsed.x
            totalTransform.y += parsed.y
            totalTransform.scaleX *= parsed.scaleX
            totalTransform.scaleY *= parsed.scaleY
            totalTransform.rotation += parsed.rotation
          }
          currentEl = currentEl.parentElement
        }

        // Apply transforms to bounding box
        let finalX = bbox.x + totalTransform.x
        let finalY = bbox.y + totalTransform.y
        let finalWidth = bbox.width * totalTransform.scaleX
        let finalHeight = bbox.height * totalTransform.scaleY

        // Handle rotation (simplified - just expand bounds)
        if (totalTransform.rotation !== 0) {
          const diagonal = Math.sqrt(finalWidth * finalWidth + finalHeight * finalHeight)
          const centerX = finalX + finalWidth / 2
          const centerY = finalY + finalHeight / 2
          finalX = centerX - diagonal / 2
          finalY = centerY - diagonal / 2
          finalWidth = diagonal
          finalHeight = diagonal
        }

        // Analyze animations
        const animations = analyzeElementAnimations(useEl)

        if (debug) {
          console.log(`  ${href}: bounds (${finalX.toFixed(2)}, ${finalY.toFixed(2)}) ${finalWidth.toFixed(2)}x${finalHeight.toFixed(2)}, ${animations.length} animations`)
        }

        elementBounds.push({
          element: useEl,
          bounds: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
          hasAnimations: animations.length > 0,
          animationCount: animations.length,
          animations
        })
      })

      // Process direct visual elements
      const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g')
      visualElements.forEach(element => {
        if (!shouldIncludeElement(element)) return

        const bbox = element.getBBox()
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return

        const animations = analyzeElementAnimations(element)

        elementBounds.push({
          element,
          bounds: bbox,
          hasAnimations: animations.length > 0,
          animationCount: animations.length,
          animations
        })
      })

      // Calculate global bounds including animations
      let globalMinX = Infinity
      let globalMinY = Infinity
      let globalMaxX = -Infinity
      let globalMaxY = -Infinity

      elementBounds.forEach(item => {
        const bounds = item.bounds

        if (item.hasAnimations) {
          // Calculate bounds with animation extremes
          item.animations.forEach(anim => {
            const minX = bounds.x + anim.minTransX
            const maxX = bounds.x + bounds.width + anim.maxTransX
            const minY = bounds.y + anim.minTransY
            const maxY = bounds.y + bounds.height + anim.maxTransY

            globalMinX = Math.min(globalMinX, minX)
            globalMinY = Math.min(globalMinY, minY)
            globalMaxX = Math.max(globalMaxX, maxX)
            globalMaxY = Math.max(globalMaxY, maxY)
          })
        } else {
          // Static element
          globalMinX = Math.min(globalMinX, bounds.x)
          globalMinY = Math.min(globalMinY, bounds.y)
          globalMaxX = Math.max(globalMaxX, bounds.x + bounds.width)
          globalMaxY = Math.max(globalMaxY, bounds.y + bounds.height)
        }
      })

      const globalBounds = {
        x: globalMinX,
        y: globalMinY,
        width: globalMaxX - globalMinX,
        height: globalMaxY - globalMinY
      }

      const animationCount = elementBounds.reduce((sum, item) => sum + item.animationCount, 0)

      if (debug) {
        console.log(`Found ${elementBounds.length} elements, ${animationCount} animations`)
        console.log(`Global bounds: (${globalBounds.x.toFixed(2)}, ${globalBounds.y.toFixed(2)}) ${globalBounds.width.toFixed(2)}x${globalBounds.height.toFixed(2)}`)
      }

      return {
        originalViewBox,
        origWidth,
        origHeight,
        globalMinX: globalBounds.x,
        globalMinY: globalBounds.y,
        globalMaxX: globalBounds.x + globalBounds.width,
        globalMaxY: globalBounds.y + globalBounds.height,
        elementCount: elementBounds.length,
        animationCount,
        elements: elementBounds.map(item => ({
          id: item.element.id || item.element.tagName,
          animations: item.animationCount,
          hasAnimations: item.hasAnimations
        }))
      }
    }, options.debug)

    await browser.close()

    // Check for errors
    if (bounds.error) {
      throw new Error(bounds.error)
    }

    // Calculate new viewBox with buffer
    const newMinX = bounds.globalMinX - buffer
    const newMinY = bounds.globalMinY - buffer
    const newWidth = (bounds.globalMaxX - bounds.globalMinX) + (buffer * 2)
    const newHeight = (bounds.globalMaxY - bounds.globalMinY) + (buffer * 2)

    const newViewBox = `${newMinX.toFixed(2)} ${newMinY.toFixed(2)} ${newWidth.toFixed(2)} ${newHeight.toFixed(2)}`
    const contentWidth = bounds.globalMaxX - bounds.globalMinX
    const contentHeight = bounds.globalMaxY - bounds.globalMinY
    const savings = ((bounds.origWidth * bounds.origHeight) - (newWidth * newHeight)) / (bounds.origWidth * bounds.origHeight) * 100

    return {
      original: {
        viewBox: bounds.originalViewBox,
        width: bounds.origWidth,
        height: bounds.origHeight,
        area: bounds.origWidth * bounds.origHeight
      },
      optimized: {
        viewBox: newViewBox,
        width: newWidth,
        height: newHeight,
        area: newWidth * newHeight
      },
      content: {
        width: contentWidth,
        height: contentHeight,
        minX: bounds.globalMinX,
        minY: bounds.globalMinY,
        maxX: bounds.globalMaxX,
        maxY: bounds.globalMaxY
      },
      elements: {
        count: bounds.elementCount,
        animationCount: bounds.animationCount,
        details: bounds.elements
      },
      savings: {
        percentage: savings,
        unitsSquared: (bounds.origWidth * bounds.origHeight) - (newWidth * newHeight)
      },
      buffer
    }
  } finally {
    if (browser) await browser.close()
  }
}

// Export the calculation function for testing
module.exports = { calculateOptimization }

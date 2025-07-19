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

    // Inject our enhanced animation analysis modules into browser context
    const animationAnalyzerCode = fs.readFileSync('./animation-analyzer.js', 'utf8')
      .replace(/const \{ Matrix2D \} = require\('.*'\)/, '') // Remove Node.js require
      .replace(/const \{ calculatePathBounds, calculateMotionValuesBounds \} = require\('.*'\)/, '') // Remove path parser require
      .replace(/module\.exports = \{[^}]*\}/, '') // Remove module.exports

    // Inject SVG path parser for browser context
    const pathParserCode = fs.readFileSync('./svg-path-parser.js', 'utf8')
      .replace(/module\.exports = \{[^}]*\}/, '') // Remove module.exports

    // Inject animation combiner for browser context
    const animationCombinerCode = fs.readFileSync('./animation-combiner.js', 'utf8')
      .replace(/const \{ Matrix2D \} = require\('.*'\)/, '') // Remove Node.js require
      .replace(/module\.exports = \{[^}]*\}/, '') // Remove module.exports

    // Inject effects analyzer for browser context
    const effectsAnalyzerCode = fs.readFileSync('./effects-analyzer.js', 'utf8')
      .replace(/module\.exports = \{[^}]*\}/, '') // Remove module.exports

    // Inject transform parser for enhanced CSS transform support
    const transformParserCode = fs.readFileSync('./transform-parser.js', 'utf8')
      .replace(/module\.exports = \{[^}]*\}/, '') // Remove module.exports

    // Capture console output
    if (options.debug) {
      page.on('console', msg => console.log('Browser console:', msg.text()))
    }

    // Create HTML page with enhanced animation analysis
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          // Enhanced transform parser with CSS transform support (browser-compatible)
          ${transformParserCode}
          
          // SVG path parser functions (browser-compatible)
          ${pathParserCode}
          
          // Animation combiner functions (browser-compatible)
          ${animationCombinerCode}
          
          // Effects analyzer functions (browser-compatible)
          ${effectsAnalyzerCode}
          
          // Enhanced animation analysis functions (browser-compatible)
          ${animationAnalyzerCode}
        </script>
      </head>
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

      // Helper to get bounds for elements that may not support getBBox
      function getElementBounds (element) {
        const tagName = element.tagName.toLowerCase()

        // foreignObject doesn't support getBBox, use attributes instead
        if (tagName === 'foreignobject' || !element.getBBox) {
          const x = parseFloat(element.getAttribute('x') || '0')
          const y = parseFloat(element.getAttribute('y') || '0')
          const width = parseFloat(element.getAttribute('width') || '0')
          const height = parseFloat(element.getAttribute('height') || '0')

          if (debug) {
            console.log(`    Using attributes for ${tagName}: x=${x}, y=${y}, w=${width}, h=${height}`)
          }

          return { x, y, width, height }
        }

        // For animated elements, getBBox() can return different values depending on
        // the current animation state. Use base geometry attributes when available.
        const hasAnimations = element.querySelector('animateTransform, animate, animateMotion') !== null
        
        if (hasAnimations && (tagName === 'rect' || tagName === 'circle' || tagName === 'ellipse')) {
          if (tagName === 'rect') {
            const x = parseFloat(element.getAttribute('x') || '0')
            const y = parseFloat(element.getAttribute('y') || '0')
            const width = parseFloat(element.getAttribute('width') || '0')
            const height = parseFloat(element.getAttribute('height') || '0')
            
            if (debug) {
              console.log(`    Using base attributes for animated ${tagName}: x=${x}, y=${y}, w=${width}, h=${height}`)
            }
            
            return { x, y, width, height }
          } else if (tagName === 'circle') {
            const cx = parseFloat(element.getAttribute('cx') || '0')
            const cy = parseFloat(element.getAttribute('cy') || '0')
            const r = parseFloat(element.getAttribute('r') || '0')
            return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
          } else if (tagName === 'ellipse') {
            const cx = parseFloat(element.getAttribute('cx') || '0')
            const cy = parseFloat(element.getAttribute('cy') || '0')
            const rx = parseFloat(element.getAttribute('rx') || '0')
            const ry = parseFloat(element.getAttribute('ry') || '0')
            return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
          }
        }

        // For all other elements, use getBBox
        return element.getBBox()
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


      // Enhanced animation analysis using injected modules
      function analyzeElementAnimations (element) {
        // Use the sophisticated animation analyzer that was injected
        if (typeof window.findElementAnimations === 'function') {
          return window.findElementAnimations(element, svg, debug)
        }

        // Fallback to simple analysis if injection failed
        const animations = []
        const animatedElements = svg.querySelectorAll('animateTransform, animate, animateMotion')

        animatedElements.forEach(anim => {
          if (anim.parentElement === element) {
            // Use enhanced analysis if available
            if (typeof window.analyzeAnimation === 'function') {
              const analysis = window.analyzeAnimation(anim, svg, debug)
              if (analysis) {
                animations.push(analysis)
              }
            } else {
              // Simple fallback for translate only
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

                animations.push({
                  type: 'simple',
                  minTransX,
                  maxTransX,
                  minTransY,
                  maxTransY
                })
              }
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

          // Get the cumulative transform matrix for the container use element
          const containerMatrix = calculateCumulativeTransform ? calculateCumulativeTransform(useEl, svg) : null

          // Process each child use element in the container
          const childUseElements = referencedSymbol.querySelectorAll('use')
          childUseElements.forEach(childUse => {
            const childHref = childUse.getAttribute('xlink:href') || childUse.getAttribute('href')
            if (!childHref || !childHref.startsWith('#')) return

            const childReferencedSymbol = svg.querySelector(childHref)
            if (!childReferencedSymbol || isContainerSymbol(childReferencedSymbol)) return

            const childBbox = getElementBounds(childUse)
            if (!childBbox || childBbox.width <= 0 || childBbox.height <= 0) return

            // Get child's cumulative transform matrix
            const childMatrix = calculateCumulativeTransform ? calculateCumulativeTransform(childUse, referencedSymbol) : null
            
            // Combine container and child transforms using matrix multiplication
            let finalBounds = childBbox
            if (containerMatrix && childMatrix) {
              const combinedMatrix = containerMatrix.multiply(childMatrix)
              finalBounds = combinedMatrix.transformBounds(childBbox)
            } else if (containerMatrix) {
              finalBounds = containerMatrix.transformBounds(childBbox)
            } else if (childMatrix) {
              finalBounds = childMatrix.transformBounds(childBbox)
            }

            // Analyze animations on the child element
            const animations = analyzeElementAnimations(childUse)

            // Analyze effects on the child element
            const effects = window.analyzeElementEffects ? window.analyzeElementEffects(childUse, svg, debug) : { hasAnyEffects: false }

            // Apply filter expansion if present
            let childFinalBounds = finalBounds
            if (effects.filter && effects.filter.hasFilter && effects.filter.expansion) {
              childFinalBounds = window.applyFilterExpansion ? window.applyFilterExpansion(childFinalBounds, effects.filter.expansion, debug) : childFinalBounds
            }

            if (debug) {
              console.log(`    ${childHref}: bounds (${childFinalBounds.x.toFixed(2)}, ${childFinalBounds.y.toFixed(2)}) ${childFinalBounds.width.toFixed(2)}x${childFinalBounds.height.toFixed(2)}, ${animations.length} animations, effects: ${effects.hasAnyEffects}`)
            }

            elementBounds.push({
              element: childUse,
              bounds: childFinalBounds,
              originalBounds: finalBounds,
              hasAnimations: animations.length > 0,
              animationCount: animations.length,
              animations,
              effects,
              hasEffects: effects.hasAnyEffects
            })
          })

          return // Skip processing the container use element itself
        }

        if (debug) {
          console.log(`  Processing use element ${href}`)
        }

        const bbox = getElementBounds(useEl)
        if (!bbox || bbox.width <= 0 || bbox.height <= 0) return

        // Calculate cumulative transform matrix
        const totalMatrix = calculateCumulativeTransform ? calculateCumulativeTransform(useEl, svg) : null

        // Apply transforms to bounding box using matrix transformation
        const transformedBounds = totalMatrix ? totalMatrix.transformBounds(bbox) : bbox

        // Analyze animations
        const animations = analyzeElementAnimations(useEl)

        // Analyze effects
        const effects = window.analyzeElementEffects ? window.analyzeElementEffects(useEl, svg, debug) : { hasAnyEffects: false }

        // Apply filter expansion if present
        let useFinalBounds = transformedBounds
        if (effects.filter && effects.filter.hasFilter && effects.filter.expansion) {
          useFinalBounds = window.applyFilterExpansion ? window.applyFilterExpansion(useFinalBounds, effects.filter.expansion, debug) : useFinalBounds
        }

        if (debug) {
          console.log(`  ${href}: bounds (${useFinalBounds.x.toFixed(2)}, ${useFinalBounds.y.toFixed(2)}) ${useFinalBounds.width.toFixed(2)}x${useFinalBounds.height.toFixed(2)}, ${animations.length} animations, effects: ${effects.hasAnyEffects}`)
        }

        elementBounds.push({
          element: useEl,
          bounds: useFinalBounds,
          originalBounds: transformedBounds,
          hasAnimations: animations.length > 0,
          animationCount: animations.length,
          animations,
          effects,
          hasEffects: effects.hasAnyEffects
        })
      })

      // Process direct visual elements
      const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject')
      visualElements.forEach(element => {
        if (!shouldIncludeElement(element)) return

        const bbox = getElementBounds(element)
        const animations = analyzeElementAnimations(element)

        // Calculate cumulative transform matrix for this element
        const totalMatrix = calculateCumulativeTransform ? calculateCumulativeTransform(element, svg) : null

        // Apply transforms to bounding box using matrix transformation
        const transformedBounds = totalMatrix ? totalMatrix.transformBounds(bbox) : bbox

        if (debug && totalMatrix && !totalMatrix.isIdentity) {
          console.log(`    Transform matrix applied: ${totalMatrix.toString()}`)
          console.log(`    Original bounds: (${bbox.x}, ${bbox.y}) ${bbox.width}x${bbox.height}`)
          console.log(`    Transformed bounds: (${transformedBounds.x}, ${transformedBounds.y}) ${transformedBounds.width}x${transformedBounds.height}`)
        }

        // Analyze filter, mask, and clipPath effects
        const effects = window.analyzeElementEffects ? window.analyzeElementEffects(element, svg, debug) : { hasAnyEffects: false }

        // Apply filter expansion to bounds if present
        let finalBounds = transformedBounds
        if (effects.filter && effects.filter.hasFilter && effects.filter.expansion) {
          finalBounds = window.applyFilterExpansion ? window.applyFilterExpansion(transformedBounds, effects.filter.expansion, debug) : transformedBounds
        }

        // For animated elements, don't filter based on static bounds since animation bounds are what matter
        if ((!bbox || bbox.width <= 0 || bbox.height <= 0) && animations.length === 0 && !effects.hasAnyEffects) return

        elementBounds.push({
          element,
          bounds: finalBounds,
          originalBounds: bbox,
          hasAnimations: animations.length > 0,
          animationCount: animations.length,
          animations,
          effects,
          hasEffects: effects.hasAnyEffects
        })
      })

      // Calculate global bounds including animations
      let globalMinX = Infinity
      let globalMinY = Infinity
      let globalMaxX = -Infinity
      let globalMaxY = -Infinity

      if (debug) {
        console.log(`Starting global bounds calculation with ${elementBounds.length} elements`)
      }

      elementBounds.forEach((item, index) => {
        if (debug) {
          console.log(`Element ${index}: hasAnimations=${item.hasAnimations}, bounds=x:${item.bounds.x}, y:${item.bounds.y}, w:${item.bounds.width}, h:${item.bounds.height}`)
        }
        const bounds = item.bounds

        if (item.hasAnimations) {
          // Use animation combiner for overlapping animations
          if (typeof window.combineOverlappingAnimations === 'function') {
            const combinedBounds = window.combineOverlappingAnimations(item.animations, bounds, debug)
            globalMinX = Math.min(globalMinX, combinedBounds.x)
            globalMinY = Math.min(globalMinY, combinedBounds.y)
            globalMaxX = Math.max(globalMaxX, combinedBounds.x + combinedBounds.width)
            globalMaxY = Math.max(globalMaxY, combinedBounds.y + combinedBounds.height)
          } else {
            // Fallback to original logic
            item.animations.forEach(anim => {
              if (anim.type === 'animateTransform') {
              // Enhanced format: use matrix-based bounds calculation
                anim.transforms.forEach(transform => {
                  const matrix = transform.matrix
                  if (debug) {
                    console.log(`    Transform matrix: a=${matrix.a}, e=${matrix.e}, f=${matrix.f}`)
                    console.log(`    Base bounds: x=${bounds.x}, y=${bounds.y}, w=${bounds.width}, h=${bounds.height}`)
                  }

                  const animatedBounds = matrix.transformBounds ? matrix.transformBounds(bounds) : bounds

                  if (debug) {
                    console.log(`    Animated bounds: x=${animatedBounds.x}, y=${animatedBounds.y}, w=${animatedBounds.width}, h=${animatedBounds.height}`)
                  }

                  globalMinX = Math.min(globalMinX, animatedBounds.x)
                  globalMinY = Math.min(globalMinY, animatedBounds.y)
                  globalMaxX = Math.max(globalMaxX, animatedBounds.x + animatedBounds.width)
                  globalMaxY = Math.max(globalMaxY, animatedBounds.y + animatedBounds.height)

                  if (debug) {
                    console.log(`    Updated global: minX=${globalMinX}, minY=${globalMinY}, maxX=${globalMaxX}, maxY=${globalMaxY}`)
                  }
                })
              } else if (anim.type === 'animate') {
              // Enhanced format: handle attribute animations
                if (debug) {
                  console.log(`    Processing animate: ${anim.attributeName} with ${anim.values.length} values`)
                }
                anim.values.forEach(valueFrame => {
                  let adjustedBounds = {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                  }

                  if (valueFrame.normalizedValue && valueFrame.normalizedValue.type === 'pathData') {
                  // Handle path morphing animations
                    const pathBounds = valueFrame.normalizedValue.bounds
                    if (debug) {
                      console.log(`      Path morphing bounds: x=${pathBounds.minX}, y=${pathBounds.minY}, w=${pathBounds.maxX - pathBounds.minX}, h=${pathBounds.maxY - pathBounds.minY}`)
                    }
                    adjustedBounds = {
                      x: pathBounds.minX,
                      y: pathBounds.minY,
                      width: pathBounds.maxX - pathBounds.minX,
                      height: pathBounds.maxY - pathBounds.minY
                    }
                  } else {
                  // Handle geometric attribute animations
                    switch (anim.attributeName) {
                      case 'x':
                        adjustedBounds.x = valueFrame.value
                        break
                      case 'y':
                        adjustedBounds.y = valueFrame.value
                        break
                      case 'width':
                        adjustedBounds.width = valueFrame.value
                        break
                      case 'height':
                        adjustedBounds.height = valueFrame.value
                        break
                      case 'd':
                      // Path data should be handled above via normalizedValue
                        if (debug) {
                          console.log('      Warning: d attribute not processed as pathData')
                        }
                        break
                      default:
                      // For other attributes like stroke-width, opacity, etc.
                      // don't change bounds - just use the original bounds
                        if (debug) {
                          console.log(`      Ignoring non-geometric attribute: ${anim.attributeName}`)
                        }
                        break
                    }
                  }

                  if (debug) {
                    console.log(`      Adjusted bounds: x=${adjustedBounds.x}, y=${adjustedBounds.y}, w=${adjustedBounds.width}, h=${adjustedBounds.height}`)
                  }

                  globalMinX = Math.min(globalMinX, adjustedBounds.x)
                  globalMinY = Math.min(globalMinY, adjustedBounds.y)
                  globalMaxX = Math.max(globalMaxX, adjustedBounds.x + adjustedBounds.width)
                  globalMaxY = Math.max(globalMaxY, adjustedBounds.y + adjustedBounds.height)

                  if (debug) {
                    console.log(`      Updated global from animate: minX=${globalMinX}, minY=${globalMinY}, maxX=${globalMaxX}, maxY=${globalMaxY}`)
                  }
                })
              } else if (anim.type === 'animateMotion') {
              // Enhanced format: handle motion path animations
                const motionBounds = anim.expandedBounds || anim.motionBounds
                if (debug) {
                  console.log(`    Processing animateMotion with bounds: (${motionBounds.minX}, ${motionBounds.minY}) to (${motionBounds.maxX}, ${motionBounds.maxY})`)
                }
                globalMinX = Math.min(globalMinX, bounds.x + motionBounds.minX)
                globalMinY = Math.min(globalMinY, bounds.y + motionBounds.minY)
                globalMaxX = Math.max(globalMaxX, bounds.x + bounds.width + motionBounds.maxX)
                globalMaxY = Math.max(globalMaxY, bounds.y + bounds.height + motionBounds.maxY)
              } else if (anim.type === 'simple' || anim.minTransX !== undefined) {
              // Simple format: fallback for basic translate animations
                const minX = bounds.x + (anim.minTransX || 0)
                const maxX = bounds.x + bounds.width + (anim.maxTransX || 0)
                const minY = bounds.y + (anim.minTransY || 0)
                const maxY = bounds.y + bounds.height + (anim.maxTransY || 0)

                globalMinX = Math.min(globalMinX, minX)
                globalMinY = Math.min(globalMinY, minY)
                globalMaxX = Math.max(globalMaxX, maxX)
                globalMaxY = Math.max(globalMaxY, maxY)
              }
            })
          }
        } else {
          // Static element
          if (debug) {
            console.log(`  Static element bounds: x=${bounds.x}, y=${bounds.y}, w=${bounds.width}, h=${bounds.height}`)
          }
          globalMinX = Math.min(globalMinX, bounds.x)
          globalMinY = Math.min(globalMinY, bounds.y)
          globalMaxX = Math.max(globalMaxX, bounds.x + bounds.width)
          globalMaxY = Math.max(globalMaxY, bounds.y + bounds.height)
          if (debug) {
            console.log(`    Updated global from static: minX=${globalMinX}, minY=${globalMinY}, maxX=${globalMaxX}, maxY=${globalMaxY}`)
          }
        }
      })

      const globalBounds = {
        x: globalMinX,
        y: globalMinY,
        width: globalMaxX - globalMinX,
        height: globalMaxY - globalMinY
      }

      const animationCount = elementBounds.reduce((sum, item) => sum + item.animationCount, 0)
      const effectsCount = elementBounds.reduce((sum, item) => sum + (item.hasEffects ? 1 : 0), 0)

      if (debug) {
        console.log(`Found ${elementBounds.length} elements, ${animationCount} animations, ${effectsCount} elements with effects`)
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
        effectsCount,
        elements: elementBounds.map(item => ({
          id: item.element.id || item.element.tagName,
          animations: item.animationCount,
          hasAnimations: item.hasAnimations,
          hasEffects: item.hasEffects || false
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
        effectsCount: bounds.effectsCount,
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

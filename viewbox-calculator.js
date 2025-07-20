const fs = require('fs')
const puppeteer = require('puppeteer')
const { Matrix2D, calculateCumulativeTransform } = require('./transform-parser')

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

      // Calculate coordinate transformation for nested SVG elements
      function calculateNestedSVGTransform (svgElement) {
        const x = parseFloat(svgElement.getAttribute('x') || '0')
        const y = parseFloat(svgElement.getAttribute('y') || '0')
        const width = parseFloat(svgElement.getAttribute('width') || '0')
        const height = parseFloat(svgElement.getAttribute('height') || '0')
        const viewBox = svgElement.getAttribute('viewBox')

        if (!viewBox || width <= 0 || height <= 0) {
          // No viewBox or invalid dimensions - use identity transform with offset
          return {
            translateX: x,
            translateY: y,
            scaleX: 1,
            scaleY: 1,
            viewBoxWidth: width || 0,
            viewBoxHeight: height || 0
          }
        }

        const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number)

        if (vbWidth <= 0 || vbHeight <= 0) {
          return {
            translateX: x,
            translateY: y,
            scaleX: 1,
            scaleY: 1,
            viewBoxWidth: width,
            viewBoxHeight: height
          }
        }

        // Calculate scale factors from viewBox to viewport
        const scaleX = width / vbWidth
        const scaleY = height / vbHeight

        return {
          translateX: x - (vbX * scaleX), // Account for viewBox offset
          translateY: y - (vbY * scaleY),
          scaleX,
          scaleY,
          viewBoxWidth: vbWidth,
          viewBoxHeight: vbHeight,
          viewBoxX: vbX,
          viewBoxY: vbY
        }
      }

      // Apply nested SVG coordinate transformation to bounds
      function transformNestedBounds (bounds, svgTransform) {
        return {
          x: bounds.x * svgTransform.scaleX + svgTransform.translateX,
          y: bounds.y * svgTransform.scaleY + svgTransform.translateY,
          width: bounds.width * svgTransform.scaleX,
          height: bounds.height * svgTransform.scaleY
        }
      }

      // Recursively process nested SVG elements with accumulated coordinate transformations
      function processNestedSVG (nestedSvgElement, rootElement, accumulatedTransform = null) {
        // Calculate coordinate transformation for this nested SVG level
        const nestedTransform = calculateNestedSVGTransform(nestedSvgElement)

        // Accumulate transformations: accumulatedTransform -> nestedTransform
        let combinedTransform = nestedTransform
        if (accumulatedTransform) {
          // Apply accumulated transformation first, then nested SVG transformation
          combinedTransform = {
            translateX: accumulatedTransform.translateX + nestedTransform.translateX * accumulatedTransform.scaleX,
            translateY: accumulatedTransform.translateY + nestedTransform.translateY * accumulatedTransform.scaleY,
            scaleX: accumulatedTransform.scaleX * nestedTransform.scaleX,
            scaleY: accumulatedTransform.scaleY * nestedTransform.scaleY,
            viewBoxWidth: nestedTransform.viewBoxWidth,
            viewBoxHeight: nestedTransform.viewBoxHeight,
            viewBoxX: nestedTransform.viewBoxX,
            viewBoxY: nestedTransform.viewBoxY
          }
        }

        // Find direct children that are not nested SVGs themselves
        const directChildren = Array.from(nestedSvgElement.children).filter(child => {
          const tagName = child.tagName.toLowerCase()
          return tagName !== 'svg' &&
                 ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path', 'text', 'image', 'g', 'foreignObject'].includes(tagName)
        })

        // Process direct children
        directChildren.forEach(nestedElement => {
          const nestedBbox = getElementBounds(nestedElement)
          const nestedAnimations = analyzeElementAnimations(nestedElement)

          if (debug) {
            console.log(`    Processing nested element ${nestedElement.tagName}: bounds (${nestedBbox.x}, ${nestedBbox.y}) ${nestedBbox.width}x${nestedBbox.height}`)
          }

          // For animated elements in nested SVGs, we need to scale the animation transforms
          // by the nested SVG coordinate transformation
          let processedAnimations = nestedAnimations
          if (nestedAnimations.length > 0) {
            processedAnimations = nestedAnimations.map(anim => {
              if (anim.type === 'animateTransform' && anim.transforms) {
                // Scale animation transform values by nested SVG scale factors
                const scaledTransforms = anim.transforms.map(transform => {
                  const matrix = transform.matrix
                  if (matrix && (matrix.e !== 0 || matrix.f !== 0)) {
                    // Scale translation values by nested SVG scale factors
                    const scaledMatrix = (typeof Matrix2D !== 'undefined')
                      ? new Matrix2D(
                        matrix.a, matrix.b, matrix.c, matrix.d,
                        matrix.e * combinedTransform.scaleX, // Scale translateX
                        matrix.f * combinedTransform.scaleY // Scale translateY
                      )
                      : {
                          a: matrix.a,
                          b: matrix.b,
                          c: matrix.c,
                          d: matrix.d,
                          e: matrix.e * combinedTransform.scaleX,
                          f: matrix.f * combinedTransform.scaleY,
                          transformBounds: matrix.transformBounds
                        }
                    return { ...transform, matrix: scaledMatrix }
                  }
                  return transform
                })
                return { ...anim, transforms: scaledTransforms }
              } else if (anim.type === 'animateMotion' && anim.motionBounds) {
                // Scale motion path bounds by nested SVG scale factors
                const scaledMotionBounds = {
                  minX: anim.motionBounds.minX * combinedTransform.scaleX,
                  minY: anim.motionBounds.minY * combinedTransform.scaleY,
                  maxX: anim.motionBounds.maxX * combinedTransform.scaleX,
                  maxY: anim.motionBounds.maxY * combinedTransform.scaleY
                }
                return { ...anim, motionBounds: scaledMotionBounds, expandedBounds: scaledMotionBounds }
              }
              return anim
            })
          }

          // Apply accumulated nested SVG coordinate transformation to element bounds
          let transformedNestedBounds = transformNestedBounds(nestedBbox, combinedTransform)

          // Apply cumulative transform matrix from parent elements (group transforms, etc.)
          const totalMatrix = calculateCumulativeTransform ? calculateCumulativeTransform(nestedSvgElement, rootElement) : null
          if (totalMatrix && !totalMatrix.isIdentity()) {
            transformedNestedBounds = totalMatrix.transformBounds(transformedNestedBounds)

            if (debug) {
              console.log(`      Applied parent matrix transforms: ${totalMatrix.toString()}`)
            }
          }

          if (debug) {
            console.log(`      Nested bounds after transformation: (${transformedNestedBounds.x}, ${transformedNestedBounds.y}) ${transformedNestedBounds.width}x${transformedNestedBounds.height}`)
          }

          // Analyze effects on nested element
          const nestedEffects = window.analyzeElementEffects ? window.analyzeElementEffects(nestedElement, nestedSvgElement, debug) : { hasAnyEffects: false }

          // Apply filter expansion if present
          let finalNestedBounds = transformedNestedBounds
          if (nestedEffects.filter && nestedEffects.filter.hasFilter && nestedEffects.filter.expansion) {
            finalNestedBounds = window.applyFilterExpansion ? window.applyFilterExpansion(transformedNestedBounds, nestedEffects.filter.expansion, debug) : transformedNestedBounds
          }

          // Skip if no valid bounds and no animations/effects
          if ((!nestedBbox || nestedBbox.width <= 0 || nestedBbox.height <= 0) && processedAnimations.length === 0 && !nestedEffects.hasAnyEffects) return

          elementBounds.push({
            element: nestedElement,
            bounds: finalNestedBounds,
            originalBounds: nestedBbox,
            hasAnimations: processedAnimations.length > 0,
            animationCount: processedAnimations.length,
            animations: processedAnimations, // Use scaled animations
            effects: nestedEffects,
            hasEffects: nestedEffects.hasAnyEffects,
            nestedSVG: nestedSvgElement // Reference to immediate parent nested SVG
          })
        })

        // Find nested SVG children and process them recursively with accumulated transformation
        const nestedSvgChildren = Array.from(nestedSvgElement.children).filter(child =>
          child.tagName.toLowerCase() === 'svg'
        )

        nestedSvgChildren.forEach(childSvg => {
          processNestedSVG(childSvg, rootElement, combinedTransform)
        })
      }

      // Helper to get bounds for elements that may not support getBBox
      function getElementBounds (element) {
        const tagName = element.tagName.toLowerCase()

        // Handle elements that don't support getBBox or need special processing
        if (tagName === 'foreignobject' || tagName === 'svg' || !element.getBBox) {
          const x = parseFloat(element.getAttribute('x') || '0')
          const y = parseFloat(element.getAttribute('y') || '0')
          const width = parseFloat(element.getAttribute('width') || '0')
          const height = parseFloat(element.getAttribute('height') || '0')

          if (debug && tagName === 'svg') {
            console.log(`    Processing nested SVG: x=${x}, y=${y}, w=${width}, h=${height}`)
            const viewBox = element.getAttribute('viewBox')
            if (viewBox) {
              console.log(`      viewBox: ${viewBox}`)
            }
          } else if (debug) {
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
        // Skip elements inside defs, symbol definitions, or nested SVG elements
        let parent = element.parentElement
        while (parent && parent !== svg) {
          const tagName = parent.tagName.toLowerCase()
          if (tagName === 'defs' || tagName === 'symbol' || tagName === 'svg') {
            return false
          }
          parent = parent.parentElement
        }
        
        // Check if element is visible
        if (!isElementVisible(element)) {
          return false
        }
        
        return true
      }
      
      function isElementVisible (element) {
        // First check element attributes (fastest check)
        if (element.getAttribute('display') === 'none' ||
            element.getAttribute('visibility') === 'hidden') {
          return false
        }
        
        // Check opacity attribute
        const opacityAttr = element.getAttribute('opacity')
        if (opacityAttr === '0' || opacityAttr === '0.0') {
          return false
        }
        
        // Use getComputedStyle for comprehensive style checking
        try {
          const computed = getComputedStyle(element)
          
          // Check computed display
          if (computed.display === 'none') {
            return false
          }
          
          // Check computed visibility
          if (computed.visibility === 'hidden') {
            return false
          }
          
          // Check computed opacity
          const opacity = parseFloat(computed.opacity)
          if (opacity === 0) {
            return false
          }
          
          // Additional check: offsetParent for display:none detection
          // Note: offsetParent is null for SVG elements, fixed positioned elements
          // Only use this check for HTML elements
          const tagName = element.tagName.toLowerCase()
          const isSVGElement = element instanceof SVGElement || element.namespaceURI === 'http://www.w3.org/2000/svg'
          
          if (!isSVGElement && !element.offsetParent && computed.position !== 'fixed') {
            return false
          }
        } catch (e) {
          // If getComputedStyle fails, fall back to attribute/inline style checks
          if (debug) {
            console.log('getComputedStyle failed for element:', e)
          }
          
          // Check inline styles as fallback
          if (element.style.display === 'none' ||
              element.style.visibility === 'hidden' ||
              element.style.opacity === '0') {
            return false
          }
        }
        
        // Check if any parent is hidden (inheritance for display and visibility)
        parent = element.parentElement
        while (parent && parent !== svg) {
          // Check parent attributes
          if (parent.getAttribute('display') === 'none' ||
              parent.getAttribute('visibility') === 'hidden') {
            return false
          }
          
          // Check parent opacity (0 opacity hides children)
          const parentOpacity = parent.getAttribute('opacity')
          if (parentOpacity === '0' || parentOpacity === '0.0') {
            return false
          }
          
          // Check parent computed styles
          try {
            const parentComputed = getComputedStyle(parent)
            if (parentComputed.display === 'none' ||
                parentComputed.visibility === 'hidden' ||
                parseFloat(parentComputed.opacity) === 0) {
              return false
            }
          } catch (e) {
            // Fallback to inline styles
            if (parent.style.display === 'none' ||
                parent.style.visibility === 'hidden' ||
                parent.style.opacity === '0') {
              return false
            }
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

      // Process direct visual elements including nested SVG containers
      const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject, svg')
      visualElements.forEach(element => {
        if (!shouldIncludeElement(element)) return

        const tagName = element.tagName.toLowerCase()

        // Handle nested SVG elements specially with recursive processing
        if (tagName === 'svg') {
          if (debug) {
            console.log('  Processing nested SVG element')
          }

          // Process this nested SVG recursively
          processNestedSVG(element, svg)

          return // Skip normal processing for nested SVG
        }

        // Normal processing for non-nested SVG elements
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
      newViewBox: {
        x: newMinX,
        y: newMinY,
        width: newWidth,
        height: newHeight
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

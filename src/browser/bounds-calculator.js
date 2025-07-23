/**
 * Browser-compatible bounds calculation module
 *
 * Calculates element bounds using native browser APIs and handles
 * special cases for different SVG element types.
 */

window.BoundsCalculator = (function () {
  'use strict'

  /**
   * Get bounds for elements that may not support getBBox
   * @param {Element} element - The element to get bounds for
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Bounds object with x, y, width, height
   */
  function getElementBounds (element, debug = false) {
    const tagName = element.tagName.toLowerCase()

    // Check if element is inside a switch element
    const isInsideSwitch = isElementInsideSwitch(element)

    // Handle foreignObject elements with special HTML layout timing handling
    if (tagName === 'foreignobject') {
      return getForeignObjectBounds(element, debug)
    }

    // Handle use elements that may reference symbols with viewBox
    if (tagName === 'use') {
      return getUseElementBounds(element, debug)
    }

    // Handle elements that don't support getBBox or need special processing
    if (tagName === 'svg' || !element.getBBox || isInsideSwitch) {
      return getElementBoundsFromAttributes(element, tagName, debug)
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
          console.log(`  Animated rect bounds from attributes: x=${x}, y=${y}, w=${width}, h=${height}`)
        }

        return { x, y, width, height }
      } else if (tagName === 'circle') {
        const cx = parseFloat(element.getAttribute('cx') || '0')
        const cy = parseFloat(element.getAttribute('cy') || '0')
        const r = parseFloat(element.getAttribute('r') || '0')

        if (debug) {
          console.log(`  Animated circle bounds: cx=${cx}, cy=${cy}, r=${r}`)
        }

        return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
      } else if (tagName === 'ellipse') {
        const cx = parseFloat(element.getAttribute('cx') || '0')
        const cy = parseFloat(element.getAttribute('cy') || '0')
        const rx = parseFloat(element.getAttribute('rx') || '0')
        const ry = parseFloat(element.getAttribute('ry') || '0')

        if (debug) {
          console.log(`  Animated ellipse bounds: cx=${cx}, cy=${cy}, rx=${rx}, ry=${ry}`)
        }

        return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
      }
    }

    // For all other elements, use getBBox and account for markers and patterns
    try {
      const bbox = element.getBBox()

      // Check for markers and expand bounds accordingly
      const markerBounds = calculateMarkerBounds(element, bbox, debug)

      let finalBounds = {
        x: Math.min(bbox.x, markerBounds.minX),
        y: Math.min(bbox.y, markerBounds.minY),
        width: Math.max(bbox.x + bbox.width, markerBounds.maxX) - Math.min(bbox.x, markerBounds.minX),
        height: Math.max(bbox.y + bbox.height, markerBounds.maxY) - Math.min(bbox.y, markerBounds.minY)
      }

      // Check for pattern fill and expand bounds if needed
      const fillValue = element.getAttribute('fill')
      if (fillValue && fillValue.includes('url(')) {
        const patternBounds = calculatePatternBounds(element, finalBounds, fillValue, debug)
        if (patternBounds) {
          finalBounds = patternBounds
        }
      }

      if (debug) {
        console.log(`  ${tagName} getBBox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`)

        if (markerBounds.hasMarkers) {
          console.log(`  ${tagName} with markers: x=${finalBounds.x}, y=${finalBounds.y}, w=${finalBounds.width}, h=${finalBounds.height}`)
        }
      }

      return finalBounds
    } catch (e) {
      if (debug) {
        console.log(`  getBBox failed for ${tagName}:`, e)
      }
      // Fallback to zero bounds if getBBox fails
      return { x: 0, y: 0, width: 0, height: 0 }
    }
  }

  /**
   * Calculate coordinate transformation for nested SVG elements
   * @param {Element} svgElement - The nested SVG element
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Transform object with translation and scale factors
   */
  function calculateNestedSVGTransform (svgElement, debug = false) {
    const x = parseFloat(svgElement.getAttribute('x') || '0')
    const y = parseFloat(svgElement.getAttribute('y') || '0')
    const width = parseFloat(svgElement.getAttribute('width') || '0')
    const height = parseFloat(svgElement.getAttribute('height') || '0')
    const viewBox = svgElement.getAttribute('viewBox')
    const preserveAspectRatio = svgElement.getAttribute('preserveAspectRatio') || 'xMidYMid meet'

    if (!viewBox || width <= 0 || height <= 0) {
      // No viewBox or invalid dimensions - use identity transform with offset
      if (debug) {
        console.log(`Nested SVG no viewBox or invalid dimensions: x=${x}, y=${y}, w=${width}, h=${height}`)
      }
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
      if (debug) {
        console.log(`Nested SVG invalid viewBox dimensions: ${viewBox}`)
      }

      return {
        translateX: x,
        translateY: y,
        scaleX: 1,
        scaleY: 1,
        viewBoxWidth: width,
        viewBoxHeight: height
      }
    }

    // Parse preserveAspectRatio attribute
    const aspectRatio = window.TransformParser.parsePreserveAspectRatio(preserveAspectRatio)

    // Calculate aspect ratio transform
    const transform = window.TransformParser.calculateAspectRatioTransform(
      width, height, vbWidth, vbHeight, aspectRatio
    )

    if (debug) {
      console.log(`Nested SVG transform: viewBox=(${vbX},${vbY},${vbWidth},${vbHeight}) viewport=(${x},${y},${width},${height}) preserveAspectRatio=${preserveAspectRatio}`)
      console.log(`  Aspect ratio: align=${aspectRatio.align}, meetOrSlice=${aspectRatio.meetOrSlice}`)
      console.log(`  Scale: ${transform.scaleX}, Offset: (${transform.offsetX},${transform.offsetY})`)
    }

    return {
      translateX: x + transform.offsetX - (vbX * transform.scaleX), // Account for viewBox offset and alignment
      translateY: y + transform.offsetY - (vbY * transform.scaleY),
      scaleX: transform.scaleX,
      scaleY: transform.scaleY,
      viewBoxWidth: vbWidth,
      viewBoxHeight: vbHeight
    }
  }

  /**
   * Apply nested SVG coordinate transformation to bounds
   * @param {Object} bounds - Original bounds object
   * @param {Object} transform - Transform object from calculateNestedSVGTransform
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Transformed bounds
   */
  function applyNestedSVGTransform (bounds, transform, debug = false) {
    const transformedBounds = {
      x: bounds.x * transform.scaleX + transform.translateX,
      y: bounds.y * transform.scaleY + transform.translateY,
      width: bounds.width * transform.scaleX,
      height: bounds.height * transform.scaleY
    }

    if (debug) {
      console.log(`Applied nested SVG transform: (${bounds.x},${bounds.y},${bounds.width},${bounds.height}) -> (${transformedBounds.x},${transformedBounds.y},${transformedBounds.width},${transformedBounds.height})`)
    }

    return transformedBounds
  }

  /**
   * Calculate additional bounds needed for markers on an element
   * @param {Element} element - The element to check for markers
   * @param {Object} elementBounds - The element's base bounds
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Marker bounds information
   */
  function calculateMarkerBounds (element, elementBounds, debug = false) {
    const markerStart = element.getAttribute('marker-start')
    const markerMid = element.getAttribute('marker-mid')
    const markerEnd = element.getAttribute('marker-end')

    if (!markerStart && !markerMid && !markerEnd) {
      return {
        hasMarkers: false,
        minX: elementBounds.x,
        minY: elementBounds.y,
        maxX: elementBounds.x + elementBounds.width,
        maxY: elementBounds.y + elementBounds.height
      }
    }

    let minX = elementBounds.x
    let minY = elementBounds.y
    let maxX = elementBounds.x + elementBounds.width
    let maxY = elementBounds.y + elementBounds.height

    const tagName = element.tagName.toLowerCase()

    // Get element points for marker positioning
    const points = getElementPoints(element, tagName)

    if (debug) {
      console.log(`  Calculating marker bounds for ${tagName} with ${points.length} points`)
    }

    // Process each marker type
    if (markerStart && points.length > 0) {
      const markerBounds = getMarkerBounds(markerStart, points[0], debug)
      if (markerBounds) {
        minX = Math.min(minX, markerBounds.x)
        minY = Math.min(minY, markerBounds.y)
        maxX = Math.max(maxX, markerBounds.x + markerBounds.width)
        maxY = Math.max(maxY, markerBounds.y + markerBounds.height)
      }
    }

    if (markerEnd && points.length > 0) {
      const markerBounds = getMarkerBounds(markerEnd, points[points.length - 1], debug)
      if (markerBounds) {
        minX = Math.min(minX, markerBounds.x)
        minY = Math.min(minY, markerBounds.y)
        maxX = Math.max(maxX, markerBounds.x + markerBounds.width)
        maxY = Math.max(maxY, markerBounds.y + markerBounds.height)
      }
    }

    if (markerMid && points.length > 2) {
      // Apply to all intermediate points
      for (let i = 1; i < points.length - 1; i++) {
        const markerBounds = getMarkerBounds(markerMid, points[i], debug)
        if (markerBounds) {
          minX = Math.min(minX, markerBounds.x)
          minY = Math.min(minY, markerBounds.y)
          maxX = Math.max(maxX, markerBounds.x + markerBounds.width)
          maxY = Math.max(maxY, markerBounds.y + markerBounds.height)
        }
      }
    }

    return {
      hasMarkers: true,
      minX,
      minY,
      maxX,
      maxY
    }
  }

  /**
   * Extract points from different element types for marker positioning
   * @param {Element} element - The SVG element
   * @param {string} tagName - Element tag name
   * @returns {Array} Array of {x, y} points
   */
  function getElementPoints (element, tagName) {
    switch (tagName) {
      case 'line': {
        return [
          { x: parseFloat(element.getAttribute('x1') || '0'), y: parseFloat(element.getAttribute('y1') || '0') },
          { x: parseFloat(element.getAttribute('x2') || '0'), y: parseFloat(element.getAttribute('y2') || '0') }
        ]
      }

      case 'polyline':
      case 'polygon': {
        const points = element.getAttribute('points') || ''
        return points.trim().split(/[\s,]+/).reduce((acc, val, idx, arr) => {
          if (idx % 2 === 0 && idx + 1 < arr.length) {
            acc.push({ x: parseFloat(val), y: parseFloat(arr[idx + 1]) })
          }
          return acc
        }, [])
      }

      case 'path': {
        // For paths, we approximate with start and end points
        // A full implementation would parse the entire path
        const d = element.getAttribute('d') || ''
        const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || []

        if (commands.length === 0) return []

        // Get start point from first command
        const firstCmd = commands[0]
        const firstMatch = firstCmd.match(/[MmLl]\s*([\d.-]+)[\s,]+([\d.-]+)/)
        if (!firstMatch) return []

        const startPoint = { x: parseFloat(firstMatch[1]), y: parseFloat(firstMatch[2]) }

        // For simplicity, assume end point is the last coordinate in the path
        const lastCmd = commands[commands.length - 1]
        const lastMatch = lastCmd.match(/([\d.-]+)[\s,]+([\d.-]+)(?!.*[\d.-])/)

        if (lastMatch) {
          const endPoint = { x: parseFloat(lastMatch[1]), y: parseFloat(lastMatch[2]) }
          return [startPoint, endPoint]
        }

        return [startPoint]
      }

      default:
        return []
    }
  }

  /**
   * Get bounds for foreignObject elements, accounting for HTML content layout
   * @param {Element} element - The foreignObject element
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Bounds object with x, y, width, height
   */
  function getForeignObjectBounds (element, debug = false) {
    // Get declared dimensions from attributes
    const declaredX = parseFloat(element.getAttribute('x') || '0')
    const declaredY = parseFloat(element.getAttribute('y') || '0')
    const declaredWidth = parseFloat(element.getAttribute('width') || '0')
    const declaredHeight = parseFloat(element.getAttribute('height') || '0')

    if (debug) {
      console.log(`  foreignObject declared bounds: x=${declaredX}, y=${declaredY}, w=${declaredWidth}, h=${declaredHeight}`)
    }

    // Try to measure actual HTML content bounds
    try {
      const actualBounds = measureForeignObjectContent(element, debug)

      if (actualBounds) {
        // Use the larger of declared vs actual dimensions to ensure no clipping
        const finalBounds = {
          x: declaredX,
          y: declaredY,
          width: Math.max(declaredWidth, actualBounds.width),
          height: Math.max(declaredHeight, actualBounds.height)
        }

        if (debug && (finalBounds.width > declaredWidth || finalBounds.height > declaredHeight)) {
          console.log(`  foreignObject content overflow detected: actual=(${actualBounds.width}x${actualBounds.height}) vs declared=(${declaredWidth}x${declaredHeight})`)
          console.log(`  Using expanded bounds: w=${finalBounds.width}, h=${finalBounds.height}`)
        }

        return finalBounds
      }
    } catch (e) {
      if (debug) {
        console.log('  Failed to measure foreignObject content:', e.message)
      }
    }

    // Fallback to declared dimensions
    return {
      x: declaredX,
      y: declaredY,
      width: declaredWidth,
      height: declaredHeight
    }
  }

  /**
   * Measure the actual rendered dimensions of HTML content inside a foreignObject
   * @param {Element} foreignObject - The foreignObject element
   * @param {boolean} debug - Enable debug logging
   * @returns {Object|null} Object with width, height of actual content, or null if measurement failed
   */
  function measureForeignObjectContent (foreignObject, debug = false) {
    try {
      // Get the HTML content container (usually the direct child div)
      const htmlContent = foreignObject.querySelector('*')
      if (!htmlContent) {
        if (debug) {
          console.log('    No HTML content found in foreignObject')
        }
        return null
      }

      // Check if content contains elements that might need loading time
      const hasImages = htmlContent.querySelector('img') !== null
      const hasLinks = htmlContent.querySelector('link[rel="stylesheet"], style') !== null

      if (hasImages || hasLinks) {
        if (debug) {
          console.log('    ForeignObject contains images/styles that may need loading time')
        }
      }

      // Get the bounding rect of the HTML content
      const contentRect = htmlContent.getBoundingClientRect()
      const foreignRect = foreignObject.getBoundingClientRect()

      if (debug) {
        console.log(`    HTML content rect: ${contentRect.width}x${contentRect.height}`)
        console.log(`    ForeignObject rect: ${foreignRect.width}x${foreignRect.height}`)
      }

      // Return the content dimensions relative to the SVG coordinate system
      // We need to convert from screen pixels to SVG units
      const svgElement = foreignObject.closest('svg')
      if (svgElement) {
        const svgRect = svgElement.getBoundingClientRect()
        const svgViewBox = svgElement.getAttribute('viewBox')

        if (svgViewBox) {
          const [, , vbWidth, vbHeight] = svgViewBox.split(' ').map(Number)
          const scaleX = vbWidth / svgRect.width
          const scaleY = vbHeight / svgRect.height

          const svgWidth = contentRect.width * scaleX
          const svgHeight = contentRect.height * scaleY

          if (debug) {
            console.log(`    Converted to SVG units: ${svgWidth}x${svgHeight} (scale: ${scaleX}, ${scaleY})`)
          }

          return {
            width: svgWidth,
            height: svgHeight
          }
        }
      }

      // Fallback: assume 1:1 pixel mapping
      return {
        width: contentRect.width,
        height: contentRect.height
      }
    } catch (e) {
      if (debug) {
        console.log('    Error measuring foreignObject content:', e.message)
      }
      return null
    }
  }

  /**
   * Check if an element is inside a switch element
   * @param {Element} element - The element to check
   * @returns {boolean} True if the element is inside a switch
   */
  function isElementInsideSwitch (element) {
    let parent = element.parentElement
    while (parent) {
      if (parent.tagName && parent.tagName.toLowerCase() === 'switch') {
        return true
      }
      parent = parent.parentElement
    }
    return false
  }

  /**
   * Get element bounds from attributes for elements that can't use getBBox
   * @param {Element} element - The element
   * @param {string} tagName - Element tag name
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Bounds object
   */
  function getElementBoundsFromAttributes (element, tagName, debug = false) {
    switch (tagName) {
      case 'rect':
      case 'foreignobject':
      case 'svg':
      case 'image': {
        const x = parseFloat(element.getAttribute('x') || '0')
        const y = parseFloat(element.getAttribute('y') || '0')
        const width = parseFloat(element.getAttribute('width') || '0')
        const height = parseFloat(element.getAttribute('height') || '0')

        if (debug) {
          console.log(`  ${tagName} bounds from attributes: x=${x}, y=${y}, w=${width}, h=${height}`)
        }

        return { x, y, width, height }
      }

      case 'circle': {
        const cx = parseFloat(element.getAttribute('cx') || '0')
        const cy = parseFloat(element.getAttribute('cy') || '0')
        const r = parseFloat(element.getAttribute('r') || '0')

        if (debug) {
          console.log(`  ${tagName} bounds from attributes: cx=${cx}, cy=${cy}, r=${r}`)
        }

        return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 }
      }

      case 'ellipse': {
        const cx = parseFloat(element.getAttribute('cx') || '0')
        const cy = parseFloat(element.getAttribute('cy') || '0')
        const rx = parseFloat(element.getAttribute('rx') || '0')
        const ry = parseFloat(element.getAttribute('ry') || '0')

        if (debug) {
          console.log(`  ${tagName} bounds from attributes: cx=${cx}, cy=${cy}, rx=${rx}, ry=${ry}`)
        }

        return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 }
      }

      case 'line': {
        const x1 = parseFloat(element.getAttribute('x1') || '0')
        const y1 = parseFloat(element.getAttribute('y1') || '0')
        const x2 = parseFloat(element.getAttribute('x2') || '0')
        const y2 = parseFloat(element.getAttribute('y2') || '0')

        const x = Math.min(x1, x2)
        const y = Math.min(y1, y2)
        const width = Math.abs(x2 - x1)
        const height = Math.abs(y2 - y1)

        if (debug) {
          console.log(`  ${tagName} bounds from attributes: x1=${x1}, y1=${y1}, x2=${x2}, y2=${y2}`)
        }

        return { x, y, width, height }
      }

      default: {
        // For other elements like path, polyline, polygon, text
        // Try getBBox if available, otherwise return zero bounds
        if (element.getBBox) {
          try {
            const bbox = element.getBBox()
            if (debug) {
              console.log(`  ${tagName} bounds from getBBox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`)
            }
            return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
          } catch (e) {
            if (debug) {
              console.log(`  getBBox failed for ${tagName}:`, e)
            }
          }
        }

        if (debug) {
          console.log(`  ${tagName} no bounds available, returning zero`)
        }

        return { x: 0, y: 0, width: 0, height: 0 }
      }
    }
  }

  /**
   * Get bounds for a specific marker at a point
   * @param {string} markerUrl - The marker URL (e.g., "url(#arrowhead)")
   * @param {Object} point - The {x, y} point where marker is positioned
   * @param {boolean} debug - Enable debug logging
   * @returns {Object|null} Marker bounds or null if not found
   */
  function getMarkerBounds (markerUrl, point, debug = false) {
    // Extract marker ID from url(#id) format
    const match = markerUrl.match(/url\(#([^)]+)\)/)
    if (!match) return null

    const markerId = match[1]
    const markerElement = document.getElementById(markerId)

    if (!markerElement || markerElement.tagName.toLowerCase() !== 'marker') {
      if (debug) {
        console.log(`  Marker not found: ${markerId}`)
      }
      return null
    }

    // Get marker dimensions
    const markerWidth = parseFloat(markerElement.getAttribute('markerWidth') || '3')
    const markerHeight = parseFloat(markerElement.getAttribute('markerHeight') || '3')
    const refX = parseFloat(markerElement.getAttribute('refX') || '0')
    const refY = parseFloat(markerElement.getAttribute('refY') || '0')

    // Calculate marker bounds relative to the point
    // Note: This is a simplified calculation - actual marker positioning
    // involves orientation and scaling that we're approximating
    const markerBounds = {
      x: point.x - refX,
      y: point.y - refY,
      width: markerWidth,
      height: markerHeight
    }

    if (debug) {
      console.log(`  Marker ${markerId} at (${point.x},${point.y}): bounds=(${markerBounds.x},${markerBounds.y},${markerBounds.width},${markerBounds.height})`)
    }

    return markerBounds
  }

  /**
   * Calculate bounds for use elements, handling symbol viewBox transformations
   * @param {Element} useElement - The use element
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Bounds object with x, y, width, height
   */
  function getUseElementBounds (useElement, debug = false) {
    // Check if SymbolViewBoxAnalyzer is available
    if (typeof window.SymbolViewBoxAnalyzer === 'undefined') {
      if (debug) {
        console.log('SymbolViewBoxAnalyzer not available, using getBBox fallback')
      }
      // Fallback to standard getBBox
      try {
        return useElement.getBBox()
      } catch (e) {
        return { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    const analyzer = new window.SymbolViewBoxAnalyzer()
    const referencedSymbol = analyzer.getReferencedSymbol(useElement, document)
    
    if (!referencedSymbol) {
      if (debug) {
        console.log('Use element does not reference a symbol, using getBBox')
      }
      // Not referencing a symbol, use standard bounds
      try {
        return useElement.getBBox()
      } catch (e) {
        return { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    // Analyze symbol viewBox transformation
    const symbolAnalysis = analyzer.analyzeSymbolViewBox(
      useElement,
      referencedSymbol,
      { getElementBounds }, // Pass reference to this module's bounds calculator
      debug
    )

    if (!symbolAnalysis.hasViewBox) {
      if (debug) {
        console.log('Symbol has no viewBox, using standard getBBox')
      }
      // Symbol has no viewBox, use standard bounds
      try {
        return useElement.getBBox()
      } catch (e) {
        return { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    // Calculate bounds by analyzing symbol content with coordinate transformation
    const symbolChildren = Array.from(referencedSymbol.children)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasContent = false

    for (const child of symbolChildren) {
      if (child.tagName.toLowerCase() === 'desc' || 
          child.tagName.toLowerCase() === 'title' ||
          child.tagName.toLowerCase() === 'metadata') {
        continue
      }

      // Get child bounds within symbol coordinate system
      const childBounds = getElementBounds(child, debug)
      if (childBounds.width > 0 && childBounds.height > 0) {
        // Transform child bounds to document coordinates
        const transformedBounds = analyzer.transformSymbolElementBounds(
          childBounds,
          symbolAnalysis,
          debug
        )

        hasContent = true
        minX = Math.min(minX, transformedBounds.x)
        minY = Math.min(minY, transformedBounds.y)
        maxX = Math.max(maxX, transformedBounds.x + transformedBounds.width)
        maxY = Math.max(maxY, transformedBounds.y + transformedBounds.height)

        if (debug) {
          console.log(`  Symbol child ${child.tagName}: original(${childBounds.x},${childBounds.y},${childBounds.width},${childBounds.height}) -> transformed(${transformedBounds.x},${transformedBounds.y},${transformedBounds.width},${transformedBounds.height})`)
        }
      }
    }

    if (!hasContent) {
      return {
        x: symbolAnalysis.useX,
        y: symbolAnalysis.useY,
        width: symbolAnalysis.useWidth,
        height: symbolAnalysis.useHeight
      }
    }

    const finalBounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }

    if (debug) {
      console.log(`  Use element final bounds: (${finalBounds.x},${finalBounds.y},${finalBounds.width},${finalBounds.height})`)
    }

    return finalBounds
  }

  /**
   * Calculate bounds for an element with pattern fill
   * @param {Element} element - The element with pattern fill
   * @param {Object} baseBounds - The element's geometric bounds
   * @param {string} fillValue - The fill attribute value
   * @param {boolean} debug - Enable debug logging
   * @returns {Object|null} Adjusted bounds or null if no pattern
   */
  function calculatePatternBounds (element, baseBounds, fillValue, debug = false) {
    // Check if PatternAnalyzer is available
    if (typeof window.PatternAnalyzer === 'undefined') {
      if (debug) {
        console.log('PatternAnalyzer not available')
      }
      return null
    }

    const patternAnalyzer = new window.PatternAnalyzer()
    const patternElement = patternAnalyzer.getPatternFromFill(fillValue, document)
    
    if (!patternElement) {
      return null
    }

    // Analyze pattern content
    const patternAnalysis = patternAnalyzer.analyzePattern(
      patternElement,
      { getElementBounds }, // Pass reference to this module's bounds calculator
      debug
    )

    // Calculate adjusted bounds
    const adjustedBounds = patternAnalyzer.calculatePatternFilledBounds(
      element,
      baseBounds,
      patternAnalysis,
      debug
    )

    if (debug && patternAnalysis.hasOverflow) {
      console.log(`  Pattern fill adjusted bounds: x=${adjustedBounds.x}, y=${adjustedBounds.y}, w=${adjustedBounds.width}, h=${adjustedBounds.height}`)
    }

    return adjustedBounds
  }

  // Public API
  return {
    getElementBounds,
    calculateNestedSVGTransform,
    applyNestedSVGTransform
  }
})()

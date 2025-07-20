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

    // Handle elements that don't support getBBox or need special processing
    if (tagName === 'foreignobject' || tagName === 'svg' || !element.getBBox) {
      const x = parseFloat(element.getAttribute('x') || '0')
      const y = parseFloat(element.getAttribute('y') || '0')
      const width = parseFloat(element.getAttribute('width') || '0')
      const height = parseFloat(element.getAttribute('height') || '0')

      if (debug) {
        console.log(`  ${tagName} bounds from attributes: x=${x}, y=${y}, w=${width}, h=${height}`)
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

    // For all other elements, use getBBox and account for markers
    try {
      const bbox = element.getBBox()

      // Check for markers and expand bounds accordingly
      const markerBounds = calculateMarkerBounds(element, bbox, debug)

      const finalBounds = {
        x: Math.min(bbox.x, markerBounds.minX),
        y: Math.min(bbox.y, markerBounds.minY),
        width: Math.max(bbox.x + bbox.width, markerBounds.maxX) - Math.min(bbox.x, markerBounds.minX),
        height: Math.max(bbox.y + bbox.height, markerBounds.maxY) - Math.min(bbox.y, markerBounds.minY)
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

    // Calculate scale factors from viewBox to viewport
    const scaleX = width / vbWidth
    const scaleY = height / vbHeight

    if (debug) {
      console.log(`Nested SVG transform: viewBox=(${vbX},${vbY},${vbWidth},${vbHeight}) viewport=(${x},${y},${width},${height}) scale=(${scaleX},${scaleY})`)
    }

    return {
      translateX: x - (vbX * scaleX), // Account for viewBox offset
      translateY: y - (vbY * scaleY),
      scaleX,
      scaleY,
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

  // Public API
  return {
    getElementBounds,
    calculateNestedSVGTransform,
    applyNestedSVGTransform
  }
})()

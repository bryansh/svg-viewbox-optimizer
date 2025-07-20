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

    // For all other elements, use getBBox
    try {
      const bbox = element.getBBox()
      if (debug) {
        console.log(`  ${tagName} getBBox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`)
      }
      return bbox
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

  // Public API
  return {
    getElementBounds,
    calculateNestedSVGTransform,
    applyNestedSVGTransform
  }
})()

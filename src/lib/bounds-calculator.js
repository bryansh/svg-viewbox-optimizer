/**
 * SVG Bounds Calculator
 * Calculates precise bounds for SVG elements including transforms and animations
 */

const { calculateCumulativeTransform } = require('./transform-parser')
const { findElementAnimations, calculateAnimatedBounds } = require('./animation-analyzer')

/**
 * Get the bounding box of an element using browser's getBBox() API
 */
function getElementBBox (element) {
  try {
    return element.getBBox()
  } catch (error) {
    // Fallback for elements that don't support getBBox()
    return {
      x: parseFloat(element.getAttribute('x')) || 0,
      y: parseFloat(element.getAttribute('y')) || 0,
      width: parseFloat(element.getAttribute('width')) || 0,
      height: parseFloat(element.getAttribute('height')) || 0
    }
  }
}

/**
 * Calculate bounds for a single element including all transforms and animations
 */
function calculateElementBounds (element, svg, debug = false) {
  const tagName = element.tagName.toLowerCase()

  if (debug) {
    console.log(`\nCalculating bounds for ${tagName}${element.id ? '#' + element.id : ''}`)
  }

  // Get the base bounding box
  const baseBounds = getElementBBox(element)

  if (debug) {
    console.log(`  Base bounds: x=${baseBounds.x}, y=${baseBounds.y}, w=${baseBounds.width}, h=${baseBounds.height}`)
  }

  // Skip elements with zero size
  if (baseBounds.width <= 0 || baseBounds.height <= 0) {
    if (debug) {
      console.log('  Skipping: zero-size element')
    }
    return null
  }

  // Calculate cumulative transform matrix
  const transformMatrix = calculateCumulativeTransform(element, svg)

  if (debug) {
    console.log(`  Transform matrix: ${transformMatrix.toString()}`)
  }

  // Find all animations affecting this element
  const animations = findElementAnimations(element, svg, debug)

  if (debug && animations.length > 0) {
    console.log(`  Found ${animations.length} animations`)
  }

  // Calculate final bounds including transforms and animations
  const finalBounds = calculateAnimatedBounds(element, transformMatrix, baseBounds, animations, debug)

  if (debug) {
    console.log(`  Final bounds: x=${finalBounds.x.toFixed(2)}, y=${finalBounds.y.toFixed(2)}, w=${finalBounds.width.toFixed(2)}, h=${finalBounds.height.toFixed(2)}`)
  }

  return {
    element,
    bounds: finalBounds,
    hasAnimations: animations.length > 0,
    animationCount: animations.length
  }
}

/**
 * Calculate bounds for a use element and its referenced content
 */
function calculateUseBounds (useElement, svg, debug = false) {
  const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href')

  if (!href || !href.startsWith('#')) {
    if (debug) {
      console.log(`  Invalid href: ${href}`)
    }
    return null
  }

  const referencedElement = svg.querySelector(href)
  if (!referencedElement) {
    if (debug) {
      console.log(`  Referenced element not found: ${href}`)
    }
    return null
  }

  if (debug) {
    console.log(`\nCalculating use element bounds: ${href}`)
  }

  // Check if the referenced element is a container (symbol with nested use elements)
  const nestedUseElements = referencedElement.querySelectorAll('use')
  if (nestedUseElements.length > 0) {
    if (debug) {
      console.log(`  Skipping container symbol with ${nestedUseElements.length} nested use elements`)
    }
    return null
  }

  // Calculate bounds for the use element itself
  return calculateElementBounds(useElement, svg, debug)
}

/**
 * Check if an element should be included in bounds calculation
 */
function shouldIncludeElement (element, svg) {
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

/**
 * Calculate bounds for all relevant elements in an SVG
 */
function calculateAllBounds (svg, debug = false) {
  const allBounds = []

  if (debug) {
    console.log('\n=== Calculating All Element Bounds ===')
  }

  // Process use elements
  const useElements = svg.querySelectorAll('use')
  if (debug) {
    console.log(`\nProcessing ${useElements.length} use elements`)
  }

  useElements.forEach((useElement, index) => {
    if (shouldIncludeElement(useElement, svg)) {
      const bounds = calculateUseBounds(useElement, svg, debug)
      if (bounds) {
        allBounds.push(bounds)
      }
    }
  })

  // Process direct visual elements
  const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g')
  if (debug) {
    console.log(`\nProcessing ${visualElements.length} direct visual elements`)
  }

  visualElements.forEach(element => {
    if (shouldIncludeElement(element, svg)) {
      const bounds = calculateElementBounds(element, svg, debug)
      if (bounds) {
        allBounds.push(bounds)
      }
    }
  })

  return allBounds
}

/**
 * Calculate the global bounding box that contains all element bounds
 */
function calculateGlobalBounds (elementBounds, debug = false) {
  if (elementBounds.length === 0) {
    return {
      x: 0, y: 0, width: 0, height: 0
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elementBounds.forEach(item => {
    const bounds = item.bounds
    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })

  const globalBounds = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }

  if (debug) {
    console.log(`\nGlobal bounds: x=${globalBounds.x.toFixed(2)}, y=${globalBounds.y.toFixed(2)}, w=${globalBounds.width.toFixed(2)}, h=${globalBounds.height.toFixed(2)}`)
  }

  return globalBounds
}

module.exports = {
  calculateElementBounds,
  calculateUseBounds,
  calculateAllBounds,
  calculateGlobalBounds,
  shouldIncludeElement
}

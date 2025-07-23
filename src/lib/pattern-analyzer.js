/**
 * Pattern Analyzer Module
 * Analyzes SVG pattern content to determine visual bounds that may extend beyond pattern tiles
 */

class PatternAnalyzer {
  /**
   * Analyze a pattern element and calculate its visual overflow
   * @param {Element} patternElement - The pattern element to analyze
   * @param {Object} boundsCalculator - Reference to bounds calculator for getting element bounds
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Pattern analysis with visual bounds
   */
  analyzePattern (patternElement, boundsCalculator, debug = false) {
    const patternId = patternElement.getAttribute('id')

    // Get pattern tile dimensions
    const patternWidth = parseFloat(patternElement.getAttribute('width')) || 0
    const patternHeight = parseFloat(patternElement.getAttribute('height')) || 0
    const patternX = parseFloat(patternElement.getAttribute('x')) || 0
    const patternY = parseFloat(patternElement.getAttribute('y')) || 0

    if (debug) {
      console.log(`Analyzing pattern #${patternId}: tile ${patternWidth}x${patternHeight} at (${patternX},${patternY})`)
    }

    // Calculate bounds of all content within the pattern
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasContent = false

    // Analyze each child element in the pattern
    const children = Array.from(patternElement.children)
    for (const child of children) {
      const childTagName = child.tagName.toLowerCase()
      if (childTagName === 'desc' ||
          childTagName === 'title' ||
          childTagName === 'metadata' ||
          childTagName === 'view' ||
          childTagName === 'cursor') {
        continue
      }

      const childBounds = boundsCalculator.getElementBounds(child, debug)
      if (childBounds.width > 0 && childBounds.height > 0) {
        hasContent = true
        minX = Math.min(minX, childBounds.x)
        minY = Math.min(minY, childBounds.y)
        maxX = Math.max(maxX, childBounds.x + childBounds.width)
        maxY = Math.max(maxY, childBounds.y + childBounds.height)

        if (debug) {
          console.log(`  Pattern child ${child.tagName}: bounds (${childBounds.x},${childBounds.y}) ${childBounds.width}x${childBounds.height}`)
        }
      }
    }

    if (!hasContent) {
      return {
        patternId,
        tileWidth: patternWidth,
        tileHeight: patternHeight,
        hasOverflow: false,
        overflow: { left: 0, top: 0, right: 0, bottom: 0 },
        visualBounds: { x: patternX, y: patternY, width: patternWidth, height: patternHeight }
      }
    }

    // Calculate overflow beyond pattern tile
    const overflow = {
      left: Math.max(0, patternX - minX),
      top: Math.max(0, patternY - minY),
      right: Math.max(0, maxX - (patternX + patternWidth)),
      bottom: Math.max(0, maxY - (patternY + patternHeight))
    }

    const hasOverflow = overflow.left > 0 || overflow.top > 0 ||
                       overflow.right > 0 || overflow.bottom > 0

    if (debug && hasOverflow) {
      console.log(`  Pattern overflow: left=${overflow.left}, top=${overflow.top}, right=${overflow.right}, bottom=${overflow.bottom}`)
    }

    return {
      patternId,
      tileWidth: patternWidth,
      tileHeight: patternHeight,
      hasOverflow,
      overflow,
      visualBounds: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    }
  }

  /**
   * Get the pattern element referenced by a fill URL
   * @param {string} fillValue - The fill attribute value (e.g., "url(#pattern1)")
   * @param {Document} doc - The document to search in
   * @returns {Element|null} The pattern element or null
   */
  getPatternFromFill (fillValue, doc) {
    if (!fillValue || !fillValue.includes('url(')) {
      return null
    }

    // Extract pattern ID from url(#patternId)
    const match = fillValue.match(/url\(#([^)]+)\)/)
    if (!match) {
      return null
    }

    const patternId = match[1]
    return doc.getElementById(patternId)
  }

  /**
   * Calculate visual bounds for an element with a pattern fill
   * @param {Element} element - The element with pattern fill
   * @param {Object} geometricBounds - The element's geometric bounds from getBBox
   * @param {Object} patternAnalysis - The pattern analysis result
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Adjusted bounds accounting for pattern overflow
   */
  calculatePatternFilledBounds (element, geometricBounds, patternAnalysis, debug = false) {
    if (!patternAnalysis.hasOverflow) {
      return geometricBounds
    }

    // Pattern overflow can appear at any edge where the pattern repeats
    // We need to expand the bounds by the maximum pattern overflow
    const expandedBounds = {
      x: geometricBounds.x - patternAnalysis.overflow.left,
      y: geometricBounds.y - patternAnalysis.overflow.top,
      width: geometricBounds.width + patternAnalysis.overflow.left + patternAnalysis.overflow.right,
      height: geometricBounds.height + patternAnalysis.overflow.top + patternAnalysis.overflow.bottom
    }

    if (debug) {
      console.log(`Pattern fill expanded bounds: (${expandedBounds.x},${expandedBounds.y}) ${expandedBounds.width}x${expandedBounds.height}`)
    }

    return expandedBounds
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PatternAnalyzer }
}

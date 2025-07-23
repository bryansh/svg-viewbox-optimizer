/**
 * Symbol ViewBox Analyzer Module
 * Handles coordinate system transformations for <use> elements referencing <symbol> elements
 * that have their own viewBox and preserveAspectRatio attributes
 */

class SymbolViewBoxAnalyzer {
  /**
   * Analyze a use element that references a symbol with viewBox
   * @param {Element} useElement - The use element
   * @param {Element} symbolElement - The referenced symbol element
   * @param {Object} boundsCalculator - Reference to bounds calculator for getting element bounds
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Symbol analysis with coordinate transformation
   */
  analyzeSymbolViewBox (useElement, symbolElement, boundsCalculator, debug = false) {
    const useId = useElement.getAttribute('href') || useElement.getAttribute('xlink:href')
    const symbolId = symbolElement.getAttribute('id')
    
    // Get use element positioning and sizing
    const useX = parseFloat(useElement.getAttribute('x')) || 0
    const useY = parseFloat(useElement.getAttribute('y')) || 0
    const useWidth = parseFloat(useElement.getAttribute('width')) || 0
    const useHeight = parseFloat(useElement.getAttribute('height')) || 0
    
    // Get symbol viewBox and preserveAspectRatio
    const viewBox = symbolElement.getAttribute('viewBox')
    const preserveAspectRatio = symbolElement.getAttribute('preserveAspectRatio') || 'xMidYMid meet'
    
    if (debug) {
      console.log(`Analyzing symbol viewBox: use(${useX},${useY},${useWidth},${useHeight}) -> symbol#${symbolId}`)
      console.log(`  Symbol viewBox: ${viewBox}, preserveAspectRatio: ${preserveAspectRatio}`)
    }
    
    // If no viewBox on symbol, no coordinate transformation needed
    if (!viewBox) {
      return {
        hasViewBox: false,
        useX,
        useY,
        useWidth,
        useHeight,
        transform: null
      }
    }
    
    // Parse viewBox
    const viewBoxParts = viewBox.split(/\s+/).map(parseFloat)
    if (viewBoxParts.length !== 4) {
      console.warn(`Invalid viewBox format: ${viewBox}`)
      return {
        hasViewBox: false,
        useX,
        useY,
        useWidth,
        useHeight,
        transform: null
      }
    }
    
    const [vbX, vbY, vbWidth, vbHeight] = viewBoxParts
    
    // If use element doesn't specify dimensions, use symbol's intrinsic size
    const effectiveWidth = useWidth || vbWidth
    const effectiveHeight = useHeight || vbHeight
    
    // Calculate coordinate transformation
    const transform = this.calculateSymbolTransform(
      effectiveWidth, effectiveHeight,
      vbX, vbY, vbWidth, vbHeight,
      preserveAspectRatio,
      debug
    )
    
    if (debug) {
      console.log(`  Transform: scale=${transform.scaleX}, offset=(${transform.offsetX},${transform.offsetY})`)
    }
    
    return {
      hasViewBox: true,
      useX,
      useY,
      useWidth: effectiveWidth,
      useHeight: effectiveHeight,
      viewBox: { x: vbX, y: vbY, width: vbWidth, height: vbHeight },
      transform,
      preserveAspectRatio
    }
  }
  
  /**
   * Calculate coordinate transformation for symbol viewBox
   * @param {number} useWidth - Use element width
   * @param {number} useHeight - Use element height  
   * @param {number} vbX - ViewBox x
   * @param {number} vbY - ViewBox y
   * @param {number} vbWidth - ViewBox width
   * @param {number} vbHeight - ViewBox height
   * @param {string} preserveAspectRatio - PreserveAspectRatio attribute
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Transform parameters
   */
  calculateSymbolTransform (useWidth, useHeight, vbX, vbY, vbWidth, vbHeight, preserveAspectRatio, debug = false) {
    // Parse preserveAspectRatio (reuse existing parser if available)
    const aspectRatio = this.parsePreserveAspectRatio(preserveAspectRatio)
    
    // Handle "none" case - non-uniform scaling
    if (aspectRatio.align === 'none') {
      return {
        scaleX: useWidth / vbWidth,
        scaleY: useHeight / vbHeight,
        offsetX: 0,
        offsetY: 0,
        translateX: -vbX,
        translateY: -vbY
      }
    }
    
    // Calculate uniform scale factor
    const scaleX = useWidth / vbWidth
    const scaleY = useHeight / vbHeight
    
    let scale
    if (aspectRatio.meetOrSlice === 'meet') {
      // "meet" - scale to fit entirely within viewport
      scale = Math.min(scaleX, scaleY)
    } else {
      // "slice" - scale to fill entire viewport (content may be clipped)
      scale = Math.max(scaleX, scaleY)
    }
    
    // Calculate scaled content dimensions
    const scaledWidth = vbWidth * scale
    const scaledHeight = vbHeight * scale
    
    // Calculate alignment offset within use element
    let offsetX = 0
    let offsetY = 0
    
    // Parse alignment
    const align = aspectRatio.align.toLowerCase()
    
    // X alignment
    if (align.includes('xmin')) {
      offsetX = 0
    } else if (align.includes('xmid')) {
      offsetX = (useWidth - scaledWidth) / 2
    } else if (align.includes('xmax')) {
      offsetX = useWidth - scaledWidth
    }
    
    // Y alignment  
    if (align.includes('ymin')) {
      offsetY = 0
    } else if (align.includes('ymid')) {
      offsetY = (useHeight - scaledHeight) / 2
    } else if (align.includes('ymax')) {
      offsetY = useHeight - scaledHeight
    }
    
    return {
      scaleX: scale,
      scaleY: scale,
      offsetX,
      offsetY,
      translateX: -vbX,
      translateY: -vbY
    }
  }
  
  /**
   * Parse preserveAspectRatio attribute
   * @param {string} preserveAspectRatio - The preserveAspectRatio attribute value
   * @returns {Object} Parsed preserveAspectRatio settings
   */
  parsePreserveAspectRatio (preserveAspectRatio) {
    // Default values according to SVG spec
    const defaults = {
      align: 'xMidYMid',
      meetOrSlice: 'meet'
    }
    
    if (!preserveAspectRatio || preserveAspectRatio.trim() === '') {
      return defaults
    }
    
    const parts = preserveAspectRatio.trim().toLowerCase().split(/\s+/)
    
    // Handle special case: "none"
    if (parts[0] === 'none') {
      return {
        align: 'none',
        meetOrSlice: 'meet' // meetOrSlice is ignored when align is "none"
      }
    }
    
    // Parse alignment (first part)
    const validAlignments = [
      'xminymin', 'xmidymin', 'xmaxymin',
      'xminymid', 'xmidymid', 'xmaxymid', 
      'xminymax', 'xmidymax', 'xmaxymax'
    ]
    
    const result = { ...defaults }
    
    if (parts[0] && validAlignments.includes(parts[0])) {
      result.align = parts[0]
    }
    
    // Parse meetOrSlice (second part, if present)
    if (parts[1] && (parts[1] === 'meet' || parts[1] === 'slice')) {
      result.meetOrSlice = parts[1]
    }
    
    return result
  }
  
  /**
   * Transform element bounds using symbol coordinate system
   * @param {Object} elementBounds - Original element bounds within symbol
   * @param {Object} symbolAnalysis - Symbol analysis result
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Transformed bounds in document coordinates
   */
  transformSymbolElementBounds (elementBounds, symbolAnalysis, debug = false) {
    if (!symbolAnalysis.hasViewBox || !symbolAnalysis.transform) {
      // No viewBox transformation, just offset by use position
      return {
        x: elementBounds.x + symbolAnalysis.useX,
        y: elementBounds.y + symbolAnalysis.useY,
        width: elementBounds.width,
        height: elementBounds.height
      }
    }
    
    const t = symbolAnalysis.transform
    
    // Apply viewBox transformation:
    // 1. Translate by viewBox origin
    // 2. Scale 
    // 3. Apply alignment offset
    // 4. Translate to use position
    
    const transformedX = (elementBounds.x + t.translateX) * t.scaleX + t.offsetX + symbolAnalysis.useX
    const transformedY = (elementBounds.y + t.translateY) * t.scaleY + t.offsetY + symbolAnalysis.useY
    const transformedWidth = elementBounds.width * t.scaleX
    const transformedHeight = elementBounds.height * t.scaleY
    
    if (debug) {
      console.log(`  Transformed bounds: (${elementBounds.x},${elementBounds.y},${elementBounds.width},${elementBounds.height}) -> (${transformedX},${transformedY},${transformedWidth},${transformedHeight})`)
    }
    
    return {
      x: transformedX,
      y: transformedY,
      width: transformedWidth,
      height: transformedHeight
    }
  }
  
  /**
   * Get the symbol element referenced by a use element
   * @param {Element} useElement - The use element
   * @param {Document} doc - The document to search in
   * @returns {Element|null} The symbol element or null
   */
  getReferencedSymbol (useElement, doc) {
    const href = useElement.getAttribute('href') || useElement.getAttribute('xlink:href')
    if (!href || !href.startsWith('#')) {
      return null
    }
    
    const symbolId = href.substring(1)
    const referencedElement = doc.getElementById(symbolId)
    
    return referencedElement && referencedElement.tagName.toLowerCase() === 'symbol' 
      ? referencedElement 
      : null
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SymbolViewBoxAnalyzer }
}
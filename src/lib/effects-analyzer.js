/**
 * SVG Effects Analyzer
 * Handles filter, mask, and clipPath effects that can impact element bounds
 */

/* global getComputedStyle */

/**
 * Parse filter effects and calculate bounds expansion
 */
function analyzeFilterEffects (element, rootSvg, debug = false) {
  const filterAttr = element.getAttribute('filter')
  const filterStyle = element.style.filter
  const filterComputed = getComputedStyle(element).filter

  const filter = filterAttr || filterStyle || filterComputed

  if (!filter || filter === 'none') {
    return { expansion: { x: 0, y: 0, width: 0, height: 0 }, hasFilter: false }
  }

  if (debug) {
    console.log(`    Analyzing filter: ${filter}`)
    if (filterAttr) console.log(`      From attribute: ${filterAttr}`)
    if (filterStyle) console.log(`      From style: ${filterStyle}`)
    if (filterComputed && filterComputed !== 'none') console.log(`      From computed: ${filterComputed}`)
  }

  let expansion = { x: 0, y: 0, width: 0, height: 0 }

  // Handle url(#id) references to filter definitions
  const urlMatch = filter.match(/url\(#([^)]+)\)/)
  if (urlMatch) {
    const filterId = urlMatch[1]
    const filterElement = rootSvg.querySelector(`#${filterId}`)

    if (filterElement) {
      expansion = analyzeFilterDefinition(filterElement, debug)
    }
  } else {
    // Handle CSS filter functions
    expansion = analyzeCSSFilters(filter, debug)
  }

  return { expansion, hasFilter: true }
}

/**
 * Analyze SVG filter definition element
 */
function analyzeFilterDefinition (filterElement, debug = false) {
  // Get filter region attributes (x, y, width, height)
  const x = parseFloat(filterElement.getAttribute('x') || '-10%')
  const y = parseFloat(filterElement.getAttribute('y') || '-10%')
  const width = parseFloat(filterElement.getAttribute('width') || '120%')
  const height = parseFloat(filterElement.getAttribute('height') || '120%')

  if (debug) {
    console.log(`      Filter region: x=${x}, y=${y}, width=${width}, height=${height}`)
  }

  // Convert percentages to decimal expansion
  const xExpansion = x < 0 ? Math.abs(x) / 100 : 0
  const yExpansion = y < 0 ? Math.abs(y) / 100 : 0
  const widthExpansion = width > 100 ? (width - 100) / 100 : 0
  const heightExpansion = height > 100 ? (height - 100) / 100 : 0

  // Also analyze individual filter primitives for additional expansion
  const primitives = filterElement.querySelectorAll('feGaussianBlur, feDropShadow, feOffset, feMorphology')
  let maxBlur = 0
  let offsetX = 0
  let offsetY = 0
  let dilate = 0

  primitives.forEach(primitive => {
    const tagName = primitive.tagName.toLowerCase()

    if (tagName === 'fegaussianblur') {
      const stdDeviation = parseFloat(primitive.getAttribute('stdDeviation') || '0')
      maxBlur = Math.max(maxBlur, stdDeviation * 3) // 3 standard deviations
    } else if (tagName === 'fedropshadow') {
      const dx = parseFloat(primitive.getAttribute('dx') || '0')
      const dy = parseFloat(primitive.getAttribute('dy') || '0')
      const stdDev = parseFloat(primitive.getAttribute('stdDeviation') || '0')
      offsetX += dx
      offsetY += dy
      maxBlur = Math.max(maxBlur, stdDev * 3)
    } else if (tagName === 'feoffset') {
      const dx = parseFloat(primitive.getAttribute('dx') || '0')
      const dy = parseFloat(primitive.getAttribute('dy') || '0')
      offsetX += dx
      offsetY += dy
    } else if (tagName === 'femorphology') {
      const operator = primitive.getAttribute('operator')
      const radius = parseFloat(primitive.getAttribute('radius') || '0')
      if (operator === 'dilate') {
        dilate = Math.max(dilate, radius)
      }
    }
  })

  if (debug && (maxBlur > 0 || offsetX !== 0 || offsetY !== 0 || dilate > 0)) {
    console.log(`      Filter effects: blur=${maxBlur}, offset=(${offsetX},${offsetY}), dilate=${dilate}`)
  }

  // Return expansion in pixels, not mixed with percentages
  // The percentage expansion is relative to element size, pixel expansion is absolute
  const pixelExpansionX = Math.abs(offsetX) + maxBlur + dilate
  const pixelExpansionY = Math.abs(offsetY) + maxBlur + dilate

  return {
    x: pixelExpansionX || xExpansion, // Use pixel if available, else percentage
    y: pixelExpansionY || yExpansion,
    width: pixelExpansionX * 2 || widthExpansion, // Expand on both sides
    height: pixelExpansionY * 2 || heightExpansion,
    isPixelBased: pixelExpansionX > 0 || pixelExpansionY > 0
  }
}

/**
 * Parse CSS function parameters (handles nested parentheses correctly)
 */
function parseCSSFunction (filterString, functionName) {
  const startPattern = `${functionName}(`
  const startIndex = filterString.indexOf(startPattern)

  if (startIndex === -1) return null

  let depth = 0
  let i = startIndex + startPattern.length
  let params = ''

  while (i < filterString.length) {
    const char = filterString[i]
    if (char === '(') {
      depth++
    } else if (char === ')') {
      if (depth === 0) {
        break
      }
      depth--
    }
    params += char
    i++
  }

  return params.trim()
}

/**
 * Extract numeric values with units from a string
 */
function extractNumericValues (str) {
  // Match numbers with optional units (px, em, rem, etc.)
  const matches = str.match(/(-?\d+(?:\.\d+)?)(px|em|rem|%)?/g) || []
  return matches.map(match => {
    const numMatch = match.match(/(-?\d+(?:\.\d+)?)/)
    return numMatch ? parseFloat(numMatch[1]) : 0
  })
}

/**
 * Analyze CSS filter functions (blur, drop-shadow, etc.)
 */
function analyzeCSSFilters (filterString, debug = false) {
  const expansion = { x: 0, y: 0, width: 0, height: 0 }

  // Parse blur() function
  const blurParams = parseCSSFunction(filterString, 'blur')
  if (blurParams) {
    const blurRadius = parseFloat(blurParams) || 0
    const blurExpansion = blurRadius * 3 // 3 times blur radius is typical expansion
    expansion.x = Math.max(expansion.x, blurExpansion)
    expansion.y = Math.max(expansion.y, blurExpansion)
    expansion.width = Math.max(expansion.width, blurExpansion * 2)
    expansion.height = Math.max(expansion.height, blurExpansion * 2)

    if (debug) {
      console.log(`      CSS blur: ${blurRadius}px -> expansion ${blurExpansion}px`)
    }
  }

  // Parse drop-shadow() function
  const shadowParams = parseCSSFunction(filterString, 'drop-shadow')
  if (shadowParams) {
    if (debug) {
      console.log(`      Shadow params: "${shadowParams}"`)
    }

    // Extract all numeric values from the drop-shadow parameters
    const numericValues = extractNumericValues(shadowParams)

    // drop-shadow can have different orders:
    // drop-shadow(offset-x offset-y blur-radius color)
    // drop-shadow(color offset-x offset-y blur-radius)
    // We'll look for the px values specifically
    const pxValues = shadowParams.match(/(-?\d+(?:\.\d+)?)px/g) || []
    const values = pxValues.map(px => parseFloat(px.replace('px', '')))

    const offsetX = values[0] || 0
    const offsetY = values[1] || 0
    const blurRadius = values[2] || 0

    if (debug) {
      console.log(`      Numeric values: [${numericValues.join(', ')}]`)
      console.log(`      Px values: [${pxValues.join(', ')}]`)
      console.log(`      Parsed: offsetX=${offsetX}, offsetY=${offsetY}, blur=${blurRadius}`)
    }

    // For drop-shadow, the expansion is directional
    // Negative offset expands in the negative direction, positive in positive direction
    // Plus blur radius expands in all directions
    const blurExpansion = blurRadius * 3

    const leftExpansion = Math.max(0, -offsetX) + blurExpansion
    const rightExpansion = Math.max(0, offsetX) + blurExpansion
    const topExpansion = Math.max(0, -offsetY) + blurExpansion
    const bottomExpansion = Math.max(0, offsetY) + blurExpansion

    expansion.x = Math.max(expansion.x, leftExpansion)
    expansion.y = Math.max(expansion.y, topExpansion)
    expansion.width = Math.max(expansion.width, leftExpansion + rightExpansion)
    expansion.height = Math.max(expansion.height, topExpansion + bottomExpansion)

    if (debug) {
      console.log(`      CSS drop-shadow: offset=(${offsetX},${offsetY}), blur=${blurRadius} -> expansion left=${leftExpansion}, right=${rightExpansion}, top=${topExpansion}, bottom=${bottomExpansion}`)
    }
  }

  return expansion
}

/**
 * Analyze mask effects on element bounds
 */
function analyzeMaskEffects (element, rootSvg, debug = false) {
  const mask = element.getAttribute('mask') ||
              element.style.mask ||
              getComputedStyle(element).mask

  if (!mask || mask === 'none') {
    return { bounds: null, hasMask: false }
  }

  if (debug) {
    console.log(`    Analyzing mask: ${mask}`)
  }

  // Handle url(#id) references to mask definitions
  const urlMatch = mask.match(/url\(#([^)]+)\)/)
  if (urlMatch) {
    const maskId = urlMatch[1]
    const maskElement = rootSvg.querySelector(`#${maskId}`)

    if (maskElement) {
      // For masks, we typically want to use the full element bounds
      // since masks define visibility, not expand bounds
      // The optimization should account for the full element even if partially masked
      return { bounds: null, hasMask: true, preserveFullBounds: true }
    }
  }

  // For CSS masks, similar approach
  return { bounds: null, hasMask: true, preserveFullBounds: true }
}

/**
 * Analyze clipPath effects on element bounds
 */
function analyzeClipPathEffects (element, rootSvg, debug = false) {
  const clipPath = element.getAttribute('clip-path') ||
                  element.style.clipPath ||
                  getComputedStyle(element).clipPath

  if (!clipPath || clipPath === 'none') {
    return { bounds: null, hasClipPath: false }
  }

  if (debug) {
    console.log(`    Analyzing clipPath: ${clipPath}`)
  }

  // Handle url(#id) references to clipPath definitions
  const urlMatch = clipPath.match(/url\(#([^)]+)\)/)
  if (urlMatch) {
    const clipPathId = urlMatch[1]
    const clipPathElement = rootSvg.querySelector(`#${clipPathId}`)

    if (clipPathElement) {
      // For clipPaths, we could either:
      // 1. Use the clipPath bounds (more accurate for final visual)
      // 2. Use full element bounds (safer for ensuring no content is cut)
      // We'll choose option 2 for safety, but could make this configurable
      return { bounds: null, hasClipPath: true, preserveFullBounds: true }
    }
  }

  // For CSS clip-path (like circle(), polygon(), etc.)
  // These are harder to parse precisely, so we'll preserve full bounds
  return { bounds: null, hasClipPath: true, preserveFullBounds: true }
}

/**
 * Apply filter expansion to element bounds
 */
function applyFilterExpansion (bounds, expansion, debug = false) {
  if (!expansion || (expansion.x === 0 && expansion.y === 0 && expansion.width === 0 && expansion.height === 0)) {
    return bounds
  }

  let expandedBounds

  if (expansion.isPixelBased || expansion.x >= 1 || expansion.y >= 1 || expansion.width >= 1 || expansion.height >= 1) {
    // Pixel-based expansion
    expandedBounds = {
      x: bounds.x - expansion.x,
      y: bounds.y - expansion.y,
      width: bounds.width + expansion.width,
      height: bounds.height + expansion.height
    }
  } else {
    // Percentage-based expansion
    const xExpand = bounds.width * expansion.x
    const yExpand = bounds.height * expansion.y
    const widthExpand = bounds.width * expansion.width
    const heightExpand = bounds.height * expansion.height

    expandedBounds = {
      x: bounds.x - xExpand,
      y: bounds.y - yExpand,
      width: bounds.width + widthExpand,
      height: bounds.height + heightExpand
    }
  }

  if (debug) {
    console.log(`      Filter expansion: (${bounds.x.toFixed(2)},${bounds.y.toFixed(2)}) ${bounds.width.toFixed(2)}x${bounds.height.toFixed(2)} -> (${expandedBounds.x.toFixed(2)},${expandedBounds.y.toFixed(2)}) ${expandedBounds.width.toFixed(2)}x${expandedBounds.height.toFixed(2)}`)
  }

  return expandedBounds
}

/**
 * Analyze all effects (filter, mask, clipPath) on an element
 */
function analyzeElementEffects (element, rootSvg, debug = false) {
  const filterAnalysis = analyzeFilterEffects(element, rootSvg, debug)
  const maskAnalysis = analyzeMaskEffects(element, rootSvg, debug)
  const clipPathAnalysis = analyzeClipPathEffects(element, rootSvg, debug)

  const hasAnyEffects = filterAnalysis.hasFilter || maskAnalysis.hasMask || clipPathAnalysis.hasClipPath

  if (debug) {
    console.log(`    Effects summary: filter=${filterAnalysis.hasFilter}, mask=${maskAnalysis.hasMask}, clipPath=${clipPathAnalysis.hasClipPath}, hasAny=${hasAnyEffects}`)
  }

  return {
    filter: filterAnalysis,
    mask: maskAnalysis,
    clipPath: clipPathAnalysis,
    hasAnyEffects
  }
}

module.exports = {
  analyzeFilterEffects,
  analyzeMaskEffects,
  analyzeClipPathEffects,
  applyFilterExpansion,
  analyzeElementEffects
}

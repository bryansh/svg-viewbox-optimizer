/**
 * SVG Transform Parser
 * Handles parsing and calculation of all SVG transform types using 2D transformation matrices
 * Also supports CSS transforms with automatic fallback to SVG attributes
 */

/* global getComputedStyle */

/**
 * 2D Transformation Matrix
 * Represents: [a c e]
 *             [b d f]
 *             [0 0 1]
 */
class Matrix2D {
  constructor (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.e = e
    this.f = f
  }

  /**
   * Multiply this matrix with another matrix
   * Returns a new matrix representing the combined transformation
   */
  multiply (other) {
    return new Matrix2D(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f
    )
  }

  /**
   * Transform a point using this matrix
   */
  transformPoint (x, y) {
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f
    }
  }

  /**
   * Transform a bounding box by transforming all 4 corners
   * Returns the new bounding box that contains all transformed corners
   */
  transformBounds (bbox) {
    const corners = [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x, y: bbox.y + bbox.height },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
    ]

    const transformedCorners = corners.map(corner => this.transformPoint(corner.x, corner.y))

    const xs = transformedCorners.map(c => c.x)
    const ys = transformedCorners.map(c => c.y)

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    }
  }

  /**
   * Get identity matrix
   */
  static identity () {
    return new Matrix2D()
  }

  /**
   * Create translation matrix
   */
  static translate (tx, ty = 0) {
    return new Matrix2D(1, 0, 0, 1, tx, ty)
  }

  /**
   * Create scale matrix
   */
  static scale (sx, sy = sx) {
    return new Matrix2D(sx, 0, 0, sy, 0, 0)
  }

  /**
   * Create rotation matrix (angle in degrees)
   */
  static rotate (angle, cx = 0, cy = 0) {
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    if (cx === 0 && cy === 0) {
      return new Matrix2D(cos, sin, -sin, cos, 0, 0)
    } else {
      // Rotate around a point: translate to origin, rotate, translate back
      return Matrix2D.translate(cx, cy)
        .multiply(new Matrix2D(cos, sin, -sin, cos, 0, 0))
        .multiply(Matrix2D.translate(-cx, -cy))
    }
  }

  /**
   * Create skewX matrix (angle in degrees)
   */
  static skewX (angle) {
    const rad = (angle * Math.PI) / 180
    return new Matrix2D(1, 0, Math.tan(rad), 1, 0, 0)
  }

  /**
   * Create skewY matrix (angle in degrees)
   */
  static skewY (angle) {
    const rad = (angle * Math.PI) / 180
    return new Matrix2D(1, Math.tan(rad), 0, 1, 0, 0)
  }

  /**
   * Check if this matrix is the identity matrix
   */
  isIdentity () {
    return this.a === 1 && this.b === 0 && this.c === 0 &&
           this.d === 1 && this.e === 0 && this.f === 0
  }

  toString () {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
  }
}

/**
 * Parse a single transform function from a transform string
 */
function parseTransformFunction (func, args) {
  const values = args.split(/[,\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))

  switch (func.toLowerCase()) {
    case 'translate':
      return Matrix2D.translate(values[0] || 0, values[1] || 0)

    case 'translatex':
      return Matrix2D.translate(values[0] || 0, 0)

    case 'translatey':
      return Matrix2D.translate(0, values[0] || 0)

    case 'scale':
      return Matrix2D.scale(values[0] || 1, values[1] || values[0] || 1)

    case 'scalex':
      return Matrix2D.scale(values[0] || 1, 1)

    case 'scaley':
      return Matrix2D.scale(1, values[0] || 1)

    case 'rotate':
      return Matrix2D.rotate(values[0] || 0, values[1] || 0, values[2] || 0)

    case 'skewx':
      return Matrix2D.skewX(values[0] || 0)

    case 'skewy':
      return Matrix2D.skewY(values[0] || 0)

    case 'matrix':
      return new Matrix2D(
        values[0] || 1, values[1] || 0, values[2] || 0,
        values[3] || 1, values[4] || 0, values[5] || 0
      )

    default:
      console.warn(`Unknown transform function: ${func}`)
      return Matrix2D.identity()
  }
}

/**
 * Parse a complete transform attribute string
 * Examples:
 *   "translate(10 20)"
 *   "translate(10, 20) scale(2) rotate(45)"
 *   "matrix(1 0 0 1 10 20)"
 */
function parseTransform (transformString) {
  if (!transformString) {
    return Matrix2D.identity()
  }

  // Regex to match transform functions: function_name(arguments)
  const transformRegex = /(\w+)\s*\(([^)]*)\)/g
  let match
  let matrix = Matrix2D.identity()

  while ((match = transformRegex.exec(transformString)) !== null) {
    const func = match[1]
    const args = match[2]
    const transform = parseTransformFunction(func, args)
    matrix = matrix.multiply(transform)
  }

  return matrix
}

/**
 * Get the effective transform for an element from both SVG attributes and CSS
 * Prioritizes CSS transforms over SVG transform attributes when both exist
 */
function getElementTransform (element) {
  // For animated elements, computed CSS transform reflects animation state
  // which varies over time. Skip CSS transform checking for these elements.
  const hasAnimations = element.querySelector('animateTransform, animate, animateMotion') !== null

  // Also check for CSS animations by looking at computed style
  let hasCSSAnimations = false
  try {
    if (typeof getComputedStyle === 'function') {
      const computed = getComputedStyle(element)
      hasCSSAnimations = computed.animationName && computed.animationName !== 'none'
    }
  } catch (error) {
    // Ignore errors accessing computed styles
  }

  if (!hasAnimations && !hasCSSAnimations) {
    // Check for CSS transform first (higher priority) - only for non-animated elements
    let cssTransform = null

    try {
      // Try inline style first
      if (element.style && element.style.transform && element.style.transform !== 'none') {
        cssTransform = element.style.transform
      }

      // Fallback to computed style
      if (!cssTransform && typeof getComputedStyle === 'function') {
        const computed = getComputedStyle(element)
        if (computed.transform && computed.transform !== 'none') {
          cssTransform = computed.transform
        }
      }
    } catch (error) {
      // Silently fall back to SVG attributes if CSS access fails
    }

    // If we have a CSS transform, use it
    if (cssTransform) {
      return parseTransform(cssTransform)
    }
  }

  // For animated elements (SVG or CSS) or when no CSS transform, use SVG transform attribute
  const svgTransform = element.getAttribute('transform')
  if (svgTransform) {
    return parseTransform(svgTransform)
  }

  return Matrix2D.identity()
}

/**
 * Calculate the cumulative transform matrix for an element
 * by traversing up the DOM tree and accumulating transforms from both SVG and CSS
 */
function calculateCumulativeTransform (element, rootElement) {
  let matrix = Matrix2D.identity()
  let current = element

  while (current && current !== rootElement) {
    const elementMatrix = getElementTransform(current)
    if (elementMatrix) {
      matrix = elementMatrix.multiply(matrix)
    }
    current = current.parentElement
  }

  return matrix
}

/**
 * Parse preserveAspectRatio attribute
 * @param {string} preserveAspectRatio - The preserveAspectRatio attribute value
 * @returns {Object} Parsed preserveAspectRatio settings
 */
function parsePreserveAspectRatio (preserveAspectRatio) {
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
      meetOrSlice: 'meet'
    }
  }

  const result = { ...defaults }

  // Parse alignment (first part)
  const validAlignments = [
    'xminymin', 'xmidymin', 'xmaxymin',
    'xminymid', 'xmidymid', 'xmaxymid',
    'xminymax', 'xmidymax', 'xmaxymax'
  ]

  if (parts[0] && validAlignments.includes(parts[0])) {
    result.align = parts[0]
  }

  // Parse meetOrSlice (second part)
  if (parts[1] && (parts[1] === 'meet' || parts[1] === 'slice')) {
    result.meetOrSlice = parts[1]
  }

  return result
}

/**
 * Calculate aspect ratio transform for nested SVG
 * @param {number} viewportWidth - The viewport width
 * @param {number} viewportHeight - The viewport height
 * @param {number} viewBoxWidth - The viewBox width
 * @param {number} viewBoxHeight - The viewBox height
 * @param {Object} preserveAspectRatio - Parsed preserveAspectRatio settings
 * @returns {Object} Transform parameters with uniform scaling and alignment offset
 */
function calculateAspectRatioTransform (viewportWidth, viewportHeight, viewBoxWidth, viewBoxHeight, preserveAspectRatio) {
  // Handle "none" case - non-uniform scaling
  if (preserveAspectRatio.align === 'none') {
    return {
      scaleX: viewportWidth / viewBoxWidth,
      scaleY: viewportHeight / viewBoxHeight,
      offsetX: 0,
      offsetY: 0
    }
  }

  // Calculate uniform scale factor
  const scaleX = viewportWidth / viewBoxWidth
  const scaleY = viewportHeight / viewBoxHeight

  let scale
  if (preserveAspectRatio.meetOrSlice === 'meet') {
    // "meet" - scale to fit entirely within viewport
    scale = Math.min(scaleX, scaleY)
  } else {
    // "slice" - scale to fill entire viewport (content may be clipped)
    scale = Math.max(scaleX, scaleY)
  }

  // Calculate scaled dimensions
  const scaledWidth = viewBoxWidth * scale
  const scaledHeight = viewBoxHeight * scale

  // Calculate alignment offset within viewport
  let offsetX = 0
  let offsetY = 0

  // Parse alignment
  const align = preserveAspectRatio.align.toLowerCase()

  // X alignment
  if (align.includes('xmin')) {
    offsetX = 0
  } else if (align.includes('xmid')) {
    offsetX = (viewportWidth - scaledWidth) / 2
  } else if (align.includes('xmax')) {
    offsetX = viewportWidth - scaledWidth
  }

  // Y alignment
  if (align.includes('ymin')) {
    offsetY = 0
  } else if (align.includes('ymid')) {
    offsetY = (viewportHeight - scaledHeight) / 2
  } else if (align.includes('ymax')) {
    offsetY = viewportHeight - scaledHeight
  }

  return {
    scaleX: scale,
    scaleY: scale,
    offsetX,
    offsetY
  }
}

module.exports = {
  Matrix2D,
  parseTransform,
  getElementTransform,
  calculateCumulativeTransform,
  parsePreserveAspectRatio,
  calculateAspectRatioTransform
}

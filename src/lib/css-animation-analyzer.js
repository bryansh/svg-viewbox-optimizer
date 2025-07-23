/**
 * CSS Animation Analyzer Module
 * Analyzes CSS @keyframes animations and calculates bounds expansion for animated elements
 */

/* global CSSRule, getComputedStyle */

class CSSAnimationAnalyzer {
  constructor (document) {
    this.document = document
    this.keyframesCache = new Map()
    this.parseAllKeyframes()
  }

  /**
   * Parse all @keyframes rules from stylesheets
   */
  parseAllKeyframes () {
    const stylesheets = Array.from(this.document.styleSheets)

    for (const stylesheet of stylesheets) {
      try {
        const rules = Array.from(stylesheet.cssRules || stylesheet.rules || [])
        for (const rule of rules) {
          if (rule.type === CSSRule.KEYFRAMES_RULE || rule.type === 7) { // 7 = KEYFRAMES_RULE constant
            this.parseKeyframesRule(rule)
          }
        }
      } catch (e) {
        // Skip stylesheets that can't be accessed (CORS issues, etc.)
        console.warn('Cannot access stylesheet rules:', e.message)
      }
    }

    // Also parse inline <style> elements
    const styleElements = this.document.querySelectorAll('style')
    for (const styleEl of styleElements) {
      this.parseInlineStyle(styleEl.textContent)
    }
  }

  /**
   * Parse a CSS keyframes rule
   * @param {CSSKeyframesRule} rule - The keyframes rule
   */
  parseKeyframesRule (rule) {
    const animationName = rule.name
    const keyframes = []

    for (const keyframe of rule.cssRules) {
      const keyText = keyframe.keyText
      const style = keyframe.style

      // Parse keyframe percentages
      const percentages = keyText.split(',').map(p => {
        p = p.trim()
        if (p === 'from') return 0
        if (p === 'to') return 100
        return parseFloat(p.replace('%', ''))
      })

      // Extract transform values
      const transform = style.transform || style.webkitTransform

      for (const percentage of percentages) {
        keyframes.push({
          percentage,
          transform: transform || 'none',
          styles: this.extractRelevantStyles(style)
        })
      }
    }

    // Sort keyframes by percentage
    keyframes.sort((a, b) => a.percentage - b.percentage)

    this.keyframesCache.set(animationName, keyframes)
  }

  /**
   * Parse inline style content for @keyframes rules
   * @param {string} cssText - CSS text content
   */
  parseInlineStyle (cssText) {
    if (!cssText) return

    // Simple regex to find @keyframes rules
    const keyframesRegex = /@keyframes\s+([^{]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g
    let match

    while ((match = keyframesRegex.exec(cssText)) !== null) {
      const animationName = match[1].trim()
      const keyframesBody = match[2]

      this.parseKeyframesBody(animationName, keyframesBody)
    }
  }

  /**
   * Parse keyframes body content
   * @param {string} animationName - Animation name
   * @param {string} keyframesBody - Keyframes body content
   */
  parseKeyframesBody (animationName, keyframesBody) {
    const keyframes = []

    // Parse individual keyframe blocks
    const keyframeRegex = /([^{]+)\s*\{([^}]+)\}/g
    let match

    while ((match = keyframeRegex.exec(keyframesBody)) !== null) {
      const keyText = match[1].trim()
      const styleText = match[2].trim()

      // Parse keyframe percentages
      const percentages = keyText.split(',').map(p => {
        p = p.trim()
        if (p === 'from') return 0
        if (p === 'to') return 100
        return parseFloat(p.replace('%', ''))
      })

      // Parse transform from style text
      const transformMatch = styleText.match(/transform\s*:\s*([^;]+)/i)
      const transform = transformMatch ? transformMatch[1].trim() : 'none'

      for (const percentage of percentages) {
        keyframes.push({
          percentage,
          transform,
          styles: this.parseStyleText(styleText)
        })
      }
    }

    // Sort keyframes by percentage
    keyframes.sort((a, b) => a.percentage - b.percentage)

    this.keyframesCache.set(animationName, keyframes)
  }

  /**
   * Extract relevant styles that affect bounds
   * @param {CSSStyleDeclaration} style - Style declaration
   * @returns {Object} Relevant styles
   */
  extractRelevantStyles (style) {
    return {
      transform: style.transform || style.webkitTransform,
      transformOrigin: style.transformOrigin || style.webkitTransformOrigin,
      left: style.left,
      top: style.top,
      width: style.width,
      height: style.height
    }
  }

  /**
   * Parse style text into relevant properties
   * @param {string} styleText - CSS style text
   * @returns {Object} Parsed styles
   */
  parseStyleText (styleText) {
    const styles = {}
    const declarations = styleText.split(';')

    for (const decl of declarations) {
      const [property, value] = decl.split(':').map(s => s.trim())
      if (property && value) {
        switch (property.toLowerCase()) {
          case 'transform':
          case '-webkit-transform':
            styles.transform = value
            break
          case 'transform-origin':
          case '-webkit-transform-origin':
            styles.transformOrigin = value
            break
          case 'left':
          case 'top':
          case 'width':
          case 'height':
            styles[property] = value
            break
        }
      }
    }

    return styles
  }

  /**
   * Analyze CSS animations for an element
   * @param {Element} element - The element to analyze
   * @param {Object} baseBounds - Element's base bounds
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Animation analysis result
   */
  analyzeElementAnimations (element, baseBounds, debug = false) {
    const computedStyle = getComputedStyle(element)
    const animationName = computedStyle.animationName
    const animationDuration = computedStyle.animationDuration
    const animationDirection = computedStyle.animationDirection || 'normal'

    if (!animationName || animationName === 'none' || !this.keyframesCache.has(animationName)) {
      return {
        hasAnimations: false,
        expansion: { x: 0, y: 0, width: 0, height: 0 }
      }
    }

    if (debug) {
      console.log(`    CSS Animation: ${animationName}, duration: ${animationDuration}, direction: ${animationDirection}`)
    }

    const keyframes = this.keyframesCache.get(animationName)
    const expansion = this.calculateAnimationBounds(element, baseBounds, keyframes, animationDirection, debug)

    return {
      hasAnimations: true,
      animationName,
      keyframes: keyframes.length,
      expansion
    }
  }

  /**
   * Calculate bounds expansion for CSS animation
   * @param {Element} element - The animated element
   * @param {Object} baseBounds - Base element bounds
   * @param {Array} keyframes - Animation keyframes
   * @param {string} direction - Animation direction
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Bounds expansion
   */
  calculateAnimationBounds (element, baseBounds, keyframes, direction, debug = false) {
    // Track the envelope of all keyframe positions
    let envelopeMinX = baseBounds.x
    let envelopeMinY = baseBounds.y
    let envelopeMaxX = baseBounds.x + baseBounds.width
    let envelopeMaxY = baseBounds.y + baseBounds.height

    // Get transform origin (defaults to center)
    // For SVG elements, we need to calculate transform-origin relative to the element bounds
    const computedStyle = getComputedStyle(element)
    let transformOriginValue = computedStyle.transformOrigin || '50% 50%'

    // Handle pixel values in transform-origin
    if (transformOriginValue.includes('px')) {
      // Parse the pixel values
      const parts = transformOriginValue.split(/\s+/)
      const xPx = parseFloat(parts[0]) || 0
      const yPx = parseFloat(parts[1]) || 0

      // Convert pixels to percentages relative to element bounds
      // For SVG elements, browsers often compute keywords to absolute viewport coordinates
      let xPercent, yPercent

      // Check for common keyword patterns
      if (xPx === 0 && yPx === 0) {
        // This is "top left"
        xPercent = '0%'
        yPercent = '0%'
      } else if (Math.abs(xPx - (baseBounds.x + baseBounds.width / 2)) < 1 &&
                 Math.abs(yPx - (baseBounds.y + baseBounds.height / 2)) < 1) {
        // This is "center" - pixel values match element center exactly
        xPercent = '50%'
        yPercent = '50%'
      } else if (Math.abs(xPx - (baseBounds.x + baseBounds.width)) < 1 &&
                 Math.abs(yPx - (baseBounds.y + baseBounds.height)) < 1) {
        // This looks like browser computed "center" as element bottom-right
        // which sometimes happens with SVG coordinate calculations
        xPercent = '50%'
        yPercent = '50%'
      } else if (Math.abs(xPx - (baseBounds.x + baseBounds.width + baseBounds.width / 2)) < 1 &&
                 Math.abs(yPx - (baseBounds.y + baseBounds.height + baseBounds.height / 2)) < 1) {
        // Another browser quirk: center computed as bottom-right + half element size
        xPercent = '50%'
        yPercent = '50%'
      } else if (Math.abs(xPx - (baseBounds.x + 50)) < 1 &&
                 Math.abs(yPx - (baseBounds.y + 50)) < 1) {
        // Browser seems to use element position + fixed offset for center
        xPercent = '50%'
        yPercent = '50%'
      } else {
        // Convert absolute pixels to element-relative percentages
        xPercent = ((xPx - baseBounds.x) / baseBounds.width * 100) + '%'
        yPercent = ((yPx - baseBounds.y) / baseBounds.height * 100) + '%'
      }

      transformOriginValue = `${xPercent} ${yPercent}`

      if (debug) {
        const elementCenter = (baseBounds.x + baseBounds.width / 2) + ', ' + (baseBounds.y + baseBounds.height / 2)
        const elementBottomRight = (baseBounds.x + baseBounds.width) + ', ' + (baseBounds.y + baseBounds.height)
        const elementEndPlus = (baseBounds.x + baseBounds.width + baseBounds.width / 2) + ', ' + (baseBounds.y + baseBounds.height + baseBounds.height / 2)
        console.log(`      Element center should be: (${elementCenter})`)
        console.log(`      Element bottom-right: (${elementBottomRight})`)
        console.log(`      Element BR + half-size: (${elementEndPlus})`)
        console.log(`      Browser computed origin: (${xPx}, ${yPx})`)
        console.log(`      Converted pixel origin ${parts[0]} ${parts[1]} to ${xPercent} ${yPercent}`)
      }
    }

    const transformOrigin = this.parseTransformOrigin(transformOriginValue, baseBounds)

    if (debug) {
      console.log(`      Transform origin raw: "${computedStyle.transformOrigin || '50% 50%'}"`)
      console.log(`      Transform origin: (${transformOrigin.x}, ${transformOrigin.y})`)
    }

    // Process keyframes based on animation direction
    const processedKeyframes = this.processKeyframesByDirection(keyframes, direction)

    for (const keyframe of processedKeyframes) {
      if (keyframe.transform && keyframe.transform !== 'none') {
        const bounds = this.calculateTransformedBounds(
          baseBounds,
          keyframe.transform,
          transformOrigin,
          debug
        )

        // Update the envelope to include this keyframe's bounds
        envelopeMinX = Math.min(envelopeMinX, bounds.x)
        envelopeMinY = Math.min(envelopeMinY, bounds.y)
        envelopeMaxX = Math.max(envelopeMaxX, bounds.x + bounds.width)
        envelopeMaxY = Math.max(envelopeMaxY, bounds.y + bounds.height)

        if (debug) {
          console.log(`        ${keyframe.percentage}%: transform="${keyframe.transform}" -> bounds(${bounds.x},${bounds.y},${bounds.width},${bounds.height})`)
        }
      }
    }

    // Calculate expansions from the envelope relative to base bounds
    const leftExpansion = envelopeMinX - baseBounds.x
    const topExpansion = envelopeMinY - baseBounds.y
    const rightExpansion = envelopeMaxX - (baseBounds.x + baseBounds.width)
    const bottomExpansion = envelopeMaxY - (baseBounds.y + baseBounds.height)

    return {
      x: leftExpansion,
      y: topExpansion,
      width: rightExpansion - leftExpansion,
      height: bottomExpansion - topExpansion
    }
  }

  /**
   * Process keyframes based on animation direction
   * @param {Array} keyframes - Original keyframes
   * @param {string} direction - Animation direction
   * @returns {Array} Processed keyframes
   */
  processKeyframesByDirection (keyframes, direction) {
    switch (direction) {
      case 'reverse':
        return [...keyframes].reverse()
      case 'alternate':
      case 'alternate-reverse':
        // For alternate, include both forward and reverse
        return [...keyframes, ...[...keyframes].reverse()]
      default:
        return keyframes
    }
  }

  /**
   * Parse transform-origin value
   * @param {string} transformOrigin - CSS transform-origin value
   * @param {Object} bounds - Element bounds
   * @returns {Object} Parsed origin coordinates
   */
  parseTransformOrigin (transformOrigin, bounds) {
    const parts = transformOrigin.split(/\s+/)
    const x = this.parseOriginValue(parts[0] || '50%', bounds.width)
    const y = this.parseOriginValue(parts[1] || '50%', bounds.height)

    return {
      x: bounds.x + x,
      y: bounds.y + y
    }
  }

  /**
   * Parse a single transform-origin value
   * @param {string} value - Origin value (%, px, keywords)
   * @param {number} dimension - Reference dimension
   * @returns {number} Parsed value
   */
  parseOriginValue (value, dimension) {
    if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * dimension
    } else if (value.endsWith('px')) {
      return parseFloat(value)
    } else {
      // Handle keywords
      switch (value) {
        case 'left': case 'top': return 0
        case 'center': return dimension / 2
        case 'right': case 'bottom': return dimension
        default: return dimension / 2
      }
    }
  }

  /**
   * Calculate bounds after applying transform
   * @param {Object} baseBounds - Original bounds
   * @param {string} transform - CSS transform value
   * @param {Object} transformOrigin - Transform origin point
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Transformed bounds
   */
  calculateTransformedBounds (baseBounds, transform, transformOrigin, debug = false) {
    // Parse transform functions
    const transforms = this.parseTransform(transform)

    // Calculate corners of the original rectangle
    const corners = [
      { x: baseBounds.x, y: baseBounds.y },
      { x: baseBounds.x + baseBounds.width, y: baseBounds.y },
      { x: baseBounds.x + baseBounds.width, y: baseBounds.y + baseBounds.height },
      { x: baseBounds.x, y: baseBounds.y + baseBounds.height }
    ]

    // Apply transforms to each corner
    const transformedCorners = corners.map(corner => {
      return this.applyTransforms(corner, transforms, transformOrigin)
    })

    // Find bounding box of transformed corners
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
   * Parse CSS transform string into transform functions
   * @param {string} transform - CSS transform value
   * @returns {Array} Array of transform functions
   */
  parseTransform (transform) {
    const transforms = []
    const regex = /(\w+)\s*\([^)]+\)/g
    let match

    while ((match = regex.exec(transform)) !== null) {
      const func = match[0]
      const name = match[1]
      const argsMatch = func.match(/\(([^)]+)\)/)
      const args = argsMatch ? argsMatch[1].split(',').map(s => s.trim()) : []

      transforms.push({ name, args })
    }

    return transforms
  }

  /**
   * Apply transforms to a point
   * @param {Object} point - Point to transform
   * @param {Array} transforms - Transform functions
   * @param {Object} origin - Transform origin
   * @returns {Object} Transformed point
   */
  applyTransforms (point, transforms, origin) {
    let x = point.x
    let y = point.y

    // Translate to origin
    x -= origin.x
    y -= origin.y

    // Apply each transform
    for (const transform of transforms) {
      const result = this.applyTransform({ x, y }, transform)
      x = result.x
      y = result.y
    }

    // Translate back from origin
    x += origin.x
    y += origin.y

    return { x, y }
  }

  /**
   * Apply a single transform to a point
   * @param {Object} point - Point to transform
   * @param {Object} transform - Transform function
   * @returns {Object} Transformed point
   */
  applyTransform (point, transform) {
    const { name, args } = transform
    let { x, y } = point

    switch (name) {
      case 'translateX':
        x += parseFloat(args[0]) || 0
        break
      case 'translateY':
        y += parseFloat(args[0]) || 0
        break
      case 'translate':
        x += parseFloat(args[0]) || 0
        y += parseFloat(args[1]) || 0
        break
      case 'scaleX':
        x *= parseFloat(args[0]) || 1
        break
      case 'scaleY':
        y *= parseFloat(args[0]) || 1
        break
      case 'scale': {
        const scaleX = parseFloat(args[0]) || 1
        const scaleY = parseFloat(args[1]) || scaleX
        x *= scaleX
        y *= scaleY
        break
      }
      case 'rotate': {
        const angle = (parseFloat(args[0]) || 0) * Math.PI / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const newX = x * cos - y * sin
        const newY = x * sin + y * cos
        x = newX
        y = newY
        break
      }
      case 'skewX': {
        const skewXAngle = (parseFloat(args[0]) || 0) * Math.PI / 180
        x += y * Math.tan(skewXAngle)
        break
      }
      case 'skewY': {
        const skewYAngle = (parseFloat(args[0]) || 0) * Math.PI / 180
        y += x * Math.tan(skewYAngle)
        break
      }
      case 'matrix': {
        // matrix(a, b, c, d, e, f)
        const [a, b, c, d, e, f] = args.map(arg => parseFloat(arg) || 0)
        const newX2 = a * x + c * y + e
        const newY2 = b * x + d * y + f
        x = newX2
        y = newY2
        break
      }
    }

    return { x, y }
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CSSAnimationAnalyzer }
}

/**
 * SVG Animation Analyzer
 * Analyzes all types of SVG animations to calculate bounds over time
 */

const { Matrix2D } = require('./transform-parser')
const { calculatePathBounds, calculateMotionValuesBounds } = require('./svg-path-parser')

/**
 * Parse and normalize transform values into structured objects
 */
function parseTransformValue (valueString, transformType) {
  const values = valueString.split(/[,\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))

  switch (transformType.toLowerCase()) {
    case 'translate':
      return {
        type: 'translate',
        x: values[0] || 0,
        y: values[1] || 0
      }

    case 'scale':
      return {
        type: 'scale',
        x: values[0] || 1,
        y: values[1] || values[0] || 1
      }

    case 'rotate':
      return {
        type: 'rotate',
        angle: values[0] || 0,
        cx: values[1] || 0,
        cy: values[2] || 0
      }

    case 'skewx':
      return {
        type: 'skewX',
        angle: values[0] || 0
      }

    case 'skewy':
      return {
        type: 'skewY',
        angle: values[0] || 0
      }

    default:
      return {
        type: transformType,
        values
      }
  }
}

/**
 * Parse and normalize attribute values (for animate elements)
 */
function parseAttributeValue (valueString, attributeName) {
  const numValue = parseFloat(valueString)

  return {
    type: 'attribute',
    attribute: attributeName,
    value: isNaN(numValue) ? valueString : numValue
  }
}

/**
 * Parse and normalize motion path values
 */
function parseMotionValue (valueString, isPath = false) {
  if (isPath) {
    // Parse SVG path data
    const bounds = calculatePathBounds(valueString)
    return {
      type: 'motion',
      path: valueString,
      bounds
    }
  } else {
    // Parse coordinate values (x1,y1;x2,y2;...)
    const bounds = calculateMotionValuesBounds(valueString)
    return {
      type: 'motion',
      values: valueString,
      bounds
    }
  }
}

/**
 * Parse animation timing and values
 */
function parseAnimationTiming (element) {
  const dur = element.getAttribute('dur') || 'indefinite'
  const repeatCount = element.getAttribute('repeatCount') || '1'
  const begin = element.getAttribute('begin') || '0s'
  const end = element.getAttribute('end')

  return {
    duration: dur === 'indefinite' ? Infinity : parseFloat(dur.replace(/s$/, '')) * 1000,
    repeatCount: repeatCount === 'indefinite' ? Infinity : parseFloat(repeatCount),
    begin: parseFloat(begin.replace(/s$/, '')) * 1000,
    end: end ? parseFloat(end.replace(/s$/, '')) * 1000 : null
  }
}

/**
 * Enhanced keyframes parser with normalized values and calcMode support
 */
function parseKeyframes (element) {
  const values = element.getAttribute('values')
  const keyTimes = element.getAttribute('keyTimes')
  const keySplines = element.getAttribute('keySplines')
  const calcMode = element.getAttribute('calcMode') || 'linear'
  const animationType = element.tagName.toLowerCase()

  // Get the type of animation for value parsing
  const transformType = element.getAttribute('type') // for animateTransform
  const attributeName = element.getAttribute('attributeName') // for animate

  // Handle from/to/by syntax
  if (!values) {
    const from = element.getAttribute('from')
    const to = element.getAttribute('to')
    const by = element.getAttribute('by')

    if (from && to) {
      return [
        { time: 0, value: parseValueByType(from, animationType, transformType, attributeName) },
        { time: 1, value: parseValueByType(to, animationType, transformType, attributeName) }
      ]
    } else if (from && by) {
      return [
        { time: 0, value: parseValueByType(from, animationType, transformType, attributeName) },
        { time: 1, value: parseValueByType(by, animationType, transformType, attributeName) }
      ]
    }
    return []
  }

  const valueList = values.split(';').map(v => v.trim())
  const timeList = keyTimes ? keyTimes.split(';').map(t => parseFloat(t.trim())) : null
  const splineList = keySplines ? keySplines.split(';') : null

  // Generate default keyTimes based on calcMode if not provided
  const defaultTimes = generateDefaultKeyTimes(valueList.length, calcMode)
  const finalTimes = timeList || defaultTimes

  return valueList.map((value, index) => ({
    time: finalTimes[index] || (index / (valueList.length - 1)),
    value: parseValueByType(value, animationType, transformType, attributeName),
    spline: splineList ? splineList[index] : null,
    calcMode
  }))
}

/**
 * Parse a value based on animation type
 */
function parseValueByType (valueString, animationType, transformType, attributeName) {
  switch (animationType) {
    case 'animatetransform':
      return parseTransformValue(valueString, transformType)
    case 'animate':
      return parseAttributeValue(valueString, attributeName)
    case 'animatemotion':
      return parseMotionValue(valueString, true) // Assume path format for keyframes
    default:
      return { type: 'unknown', value: valueString }
  }
}

/**
 * Generate default keyTimes based on calcMode
 */
function generateDefaultKeyTimes (numValues, calcMode) {
  if (numValues <= 1) return [0]

  switch (calcMode) {
    case 'discrete':
    case 'linear':
    case 'spline':
      // Evenly distributed from 0 to 1
      return Array.from({ length: numValues }, (_, i) => i / (numValues - 1))

    case 'paced':
      // For paced mode, timing depends on the distance between values
      // For now, fall back to linear distribution
      // TODO: Calculate actual paced timing based on value distances
      return Array.from({ length: numValues }, (_, i) => i / (numValues - 1))

    default:
      return Array.from({ length: numValues }, (_, i) => i / (numValues - 1))
  }
}

/**
 * Analyze animateTransform elements
 */
function analyzeAnimateTransform (animElement, debug = false) {
  const type = animElement.getAttribute('type') || 'translate'
  const additive = animElement.getAttribute('additive') === 'sum'
  const keyframes = parseKeyframes(animElement)
  const timing = parseAnimationTiming(animElement)

  if (debug) {
    console.log(`    AnimateTransform: type=${type}, additive=${additive}, ${keyframes.length} keyframes`)
  }

  const transforms = []

  keyframes.forEach(keyframe => {
    const value = keyframe.value // Now a normalized object
    let matrix

    // Use normalized value objects instead of raw parsing
    switch (value.type) {
      case 'translate':
        matrix = Matrix2D.translate(value.x, value.y)
        break
      case 'scale':
        matrix = Matrix2D.scale(value.x, value.y)
        break
      case 'rotate':
        matrix = Matrix2D.rotate(value.angle, value.cx, value.cy)
        break
      case 'skewX':
        matrix = Matrix2D.skewX(value.angle)
        break
      case 'skewY':
        matrix = Matrix2D.skewY(value.angle)
        break
      default:
        console.warn(`Unknown transform type: ${value.type}`)
        matrix = Matrix2D.identity()
    }

    transforms.push({
      time: keyframe.time,
      matrix,
      normalizedValue: value,
      calcMode: keyframe.calcMode
    })
  })

  return {
    type: 'animateTransform',
    transformType: type,
    additive,
    timing,
    transforms
  }
}

/**
 * Analyze animate elements (for properties like x, y, width, height, etc.)
 */
function analyzeAnimate (animElement, debug = false) {
  const attributeName = animElement.getAttribute('attributeName')
  const keyframes = parseKeyframes(animElement)
  const timing = parseAnimationTiming(animElement)

  if (debug) {
    console.log(`    Animate: attribute=${attributeName}, ${keyframes.length} keyframes`)
  }

  const values = keyframes.map(keyframe => ({
    time: keyframe.time,
    normalizedValue: keyframe.value,
    value: keyframe.value.value, // Extract the parsed numeric/string value
    calcMode: keyframe.calcMode
  }))

  return {
    type: 'animate',
    attributeName,
    timing,
    values
  }
}

/**
 * Analyze animateMotion elements (path-based animation)
 */
function analyzeAnimateMotion (animElement, svg, debug = false) {
  const path = animElement.getAttribute('path')
  const values = animElement.getAttribute('values')
  const timing = parseAnimationTiming(animElement)
  const rotate = animElement.getAttribute('rotate') || '0'

  if (debug) {
    console.log(`    AnimateMotion: path=${path ? 'defined' : 'none'}, values=${values ? 'defined' : 'none'}, rotate=${rotate}`)
  }

  let motionBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

  if (path) {
    // Direct path attribute
    motionBounds = calculatePathBounds(path, debug)
  } else if (values) {
    // Values attribute with coordinate pairs
    motionBounds = calculateMotionValuesBounds(values, debug)
  } else {
    // Check for mpath element
    const mpath = animElement.querySelector('mpath')
    if (mpath) {
      const href = mpath.getAttribute('href') || mpath.getAttribute('xlink:href')
      if (href && href.startsWith('#')) {
        const referencedPath = svg.querySelector(href)
        if (referencedPath && referencedPath.tagName.toLowerCase() === 'path') {
          const pathData = referencedPath.getAttribute('d')
          if (pathData) {
            motionBounds = calculatePathBounds(pathData, debug)
            if (debug) {
              console.log(`      Using mpath reference: ${href}`)
            }
          }
        }
      }
    }
  }

  // Handle rotation effects on bounds
  let rotationExpansion = 0
  if (rotate === 'auto' || rotate === 'auto-reverse') {
    // Auto rotation can expand bounds depending on element size
    // For now, add a conservative buffer
    rotationExpansion = 20
  } else if (rotate !== '0') {
    // Fixed rotation angle
    const angle = parseFloat(rotate)
    if (!isNaN(angle)) {
      rotationExpansion = Math.abs(Math.sin(angle * Math.PI / 180)) * 20 + Math.abs(Math.cos(angle * Math.PI / 180)) * 20
    }
  }

  const expandedBounds = {
    minX: motionBounds.minX - rotationExpansion,
    maxX: motionBounds.maxX + rotationExpansion,
    minY: motionBounds.minY - rotationExpansion,
    maxY: motionBounds.maxY + rotationExpansion
  }

  if (debug) {
    console.log(`      Motion bounds: (${motionBounds.minX.toFixed(2)}, ${motionBounds.minY.toFixed(2)}) to (${motionBounds.maxX.toFixed(2)}, ${motionBounds.maxY.toFixed(2)})`)
    console.log(`      With rotation expansion: (${expandedBounds.minX.toFixed(2)}, ${expandedBounds.minY.toFixed(2)}) to (${expandedBounds.maxX.toFixed(2)}, ${expandedBounds.maxY.toFixed(2)})`)
  }

  return {
    type: 'animateMotion',
    path,
    values,
    rotate,
    timing,
    motionBounds,
    expandedBounds
  }
}

/**
 * Find all animations affecting an element
 */
function findElementAnimations (element, svg, debug = false) {
  const animations = []

  // Find direct child animations
  const childAnimations = element.querySelectorAll('animateTransform, animate, animateMotion')
  childAnimations.forEach(anim => {
    animations.push(analyzeAnimation(anim, svg, debug))
  })

  // Find animations targeting this element by id
  if (element.id) {
    const targetedAnimations = svg.querySelectorAll(`animateTransform[href="#${element.id}"], animate[href="#${element.id}"], animateMotion[href="#${element.id}"]`)
    targetedAnimations.forEach(anim => {
      animations.push(analyzeAnimation(anim, svg, debug))
    })
  }

  return animations
}

/**
 * Analyze any animation element
 */
function analyzeAnimation (animElement, svg, debug = false) {
  const tagName = animElement.tagName.toLowerCase()

  switch (tagName) {
    case 'animatetransform':
      return analyzeAnimateTransform(animElement, debug)
    case 'animate':
      return analyzeAnimate(animElement, debug)
    case 'animatemotion':
      return analyzeAnimateMotion(animElement, svg, debug)
    default:
      if (debug) {
        console.warn(`Unknown animation type: ${tagName}`)
      }
      return null
  }
}

/**
 * Calculate the bounds of an element over all its animations
 */
function calculateAnimatedBounds (element, baseMatrix, baseBounds, animations, debug = false) {
  if (animations.length === 0) {
    return baseMatrix.transformBounds(baseBounds)
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  // For transform animations, we need to consider each keyframe
  animations.forEach(animation => {
    if (animation.type === 'animateTransform') {
      animation.transforms.forEach(transform => {
        let animMatrix = baseMatrix
        if (animation.additive) {
          animMatrix = baseMatrix.multiply(transform.matrix)
        } else {
          animMatrix = transform.matrix
        }

        const bounds = animMatrix.transformBounds(baseBounds)
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      })
    } else if (animation.type === 'animate') {
      // Handle property animations (x, y, width, height, etc.)
      animation.values.forEach(valueFrame => {
        const adjustedBounds = { ...baseBounds }

        switch (animation.attributeName) {
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
        }

        const bounds = baseMatrix.transformBounds(adjustedBounds)
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      })
    } else if (animation.type === 'animateMotion') {
      // Add the motion path bounds to the element bounds
      const bounds = baseMatrix.transformBounds(baseBounds)
      minX = Math.min(minX, bounds.x + animation.approximateBounds.minX)
      minY = Math.min(minY, bounds.y + animation.approximateBounds.minY)
      maxX = Math.max(maxX, bounds.x + bounds.width + animation.approximateBounds.maxX)
      maxY = Math.max(maxY, bounds.y + bounds.height + animation.approximateBounds.maxY)
    }
  })

  // If no valid bounds were calculated, fall back to base bounds
  if (minX === Infinity) {
    const bounds = baseMatrix.transformBounds(baseBounds)
    return bounds
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

module.exports = {
  findElementAnimations,
  calculateAnimatedBounds,
  analyzeAnimation
}

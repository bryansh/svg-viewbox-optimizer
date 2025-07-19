/**
 * SVG Animation Analyzer
 * Analyzes all types of SVG animations to calculate bounds over time
 */

const { Matrix2D } = require('./transform-parser')

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
 * Parse keyframes from values/keyTimes/keySplines
 */
function parseKeyframes (element) {
  const values = element.getAttribute('values')
  const keyTimes = element.getAttribute('keyTimes')
  const keySplines = element.getAttribute('keySplines')

  if (!values) {
    const from = element.getAttribute('from')
    const to = element.getAttribute('to')
    const by = element.getAttribute('by')

    if (from && to) {
      return [{ time: 0, value: from }, { time: 1, value: to }]
    } else if (from && by) {
      return [{ time: 0, value: from }, { time: 1, value: by }]
    }
    return []
  }

  const valueList = values.split(';').map(v => v.trim())
  const timeList = keyTimes ? keyTimes.split(';').map(t => parseFloat(t.trim())) : null

  return valueList.map((value, index) => ({
    time: timeList ? timeList[index] : index / (valueList.length - 1),
    value,
    spline: keySplines ? keySplines.split(';')[index] : null
  }))
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
    const values = keyframe.value.split(/[,\s]+/).map(v => parseFloat(v.trim())).filter(v => !isNaN(v))
    let matrix

    switch (type.toLowerCase()) {
      case 'translate':
        matrix = Matrix2D.translate(values[0] || 0, values[1] || 0)
        break
      case 'scale':
        matrix = Matrix2D.scale(values[0] || 1, values[1] || values[0] || 1)
        break
      case 'rotate':
        matrix = Matrix2D.rotate(values[0] || 0, values[1] || 0, values[2] || 0)
        break
      case 'skewx':
        matrix = Matrix2D.skewX(values[0] || 0)
        break
      case 'skewy':
        matrix = Matrix2D.skewY(values[0] || 0)
        break
      default:
        matrix = Matrix2D.identity()
    }

    transforms.push({
      time: keyframe.time,
      matrix,
      values
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
    value: parseFloat(keyframe.value) || 0
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
function analyzeAnimateMotion (animElement, debug = false) {
  const path = animElement.getAttribute('path')
  const timing = parseAnimationTiming(animElement)
  const rotate = animElement.getAttribute('rotate') || '0'

  if (debug) {
    console.log(`    AnimateMotion: path=${path ? 'defined' : 'none'}, rotate=${rotate}`)
  }

  // For now, we'll approximate motion paths as a bounding box
  // A full implementation would need to parse SVG path data and calculate positions
  const approximateBounds = {
    minX: -100, // Conservative estimates - could be improved with actual path parsing
    maxX: 100,
    minY: -100,
    maxY: 100
  }

  return {
    type: 'animateMotion',
    path,
    rotate,
    timing,
    approximateBounds
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
    animations.push(analyzeAnimation(anim, debug))
  })

  // Find animations targeting this element by id
  if (element.id) {
    const targetedAnimations = svg.querySelectorAll(`animateTransform[href="#${element.id}"], animate[href="#${element.id}"], animateMotion[href="#${element.id}"]`)
    targetedAnimations.forEach(anim => {
      animations.push(analyzeAnimation(anim, debug))
    })
  }

  return animations
}

/**
 * Analyze any animation element
 */
function analyzeAnimation (animElement, debug = false) {
  const tagName = animElement.tagName.toLowerCase()

  switch (tagName) {
    case 'animatetransform':
      return analyzeAnimateTransform(animElement, debug)
    case 'animate':
      return analyzeAnimate(animElement, debug)
    case 'animatemotion':
      return analyzeAnimateMotion(animElement, debug)
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

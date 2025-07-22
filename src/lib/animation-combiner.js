/**
 * Animation Combiner
 * Handles multiple overlapping animations on the same element
 */

const { Matrix2D } = require('./transform-parser')

/**
 * Combine multiple overlapping animations into a single bounds calculation
 */
function combineOverlappingAnimations (animations, baseBounds, debug = false) {
  if (animations.length === 0) {
    return baseBounds
  }

  if (debug) {
    console.log(`    Combining ${animations.length} overlapping animations`)
    console.log(`    Base bounds: (${baseBounds.x}, ${baseBounds.y}) ${baseBounds.width}x${baseBounds.height}`)
  }

  // Separate animations into categories
  const geometricAnimations = animations.filter(anim =>
    (anim.type === 'animate' && ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry'].includes(anim.attributeName)) ||
    (anim.type === 'set' && ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry'].includes(anim.attributeName)) ||
    anim.type === 'animateTransform' ||
    anim.type === 'animateMotion'
  )

  const strokeAnimations = animations.filter(anim =>
    (anim.type === 'animate' && anim.attributeName === 'stroke-width') ||
    (anim.type === 'set' && anim.attributeName === 'stroke-width')
  )

  const otherAnimations = animations.filter(anim =>
    !geometricAnimations.includes(anim) && !strokeAnimations.includes(anim)
  )

  let globalMinX = Infinity
  let globalMinY = Infinity
  let globalMaxX = -Infinity
  let globalMaxY = -Infinity

  // First, handle geometric animations to get the base geometric bounds
  const additiveAnimations = geometricAnimations.filter(anim =>
    anim.type === 'animateTransform' && anim.additive
  )
  const nonAdditiveGeometricAnimations = geometricAnimations.filter(anim =>
    anim.type !== 'animateTransform' || !anim.additive
  )

  // Check if we have circle/ellipse animations that need special envelope handling
  const hasCircleAnimations = nonAdditiveGeometricAnimations.some(anim =>
    (anim.type === 'animate' || anim.type === 'set') &&
    ['cx', 'cy', 'r', 'rx', 'ry'].includes(anim.attributeName)
  )

  if (hasCircleAnimations) {
    // For circle/ellipse animations, use envelope calculation to handle combinations properly
    const geometricState = {
      cx: [baseBounds.x + baseBounds.width / 2], // default center
      cy: [baseBounds.y + baseBounds.height / 2],
      r: [baseBounds.width / 2] // assuming circle
    }

    // Collect all possible values for circle/ellipse properties
    nonAdditiveGeometricAnimations.forEach(anim => {
      if (anim.type === 'animate') {
        const attr = anim.attributeName
        if (geometricState[attr]) {
          anim.values.forEach(valueFrame => {
            geometricState[attr].push(valueFrame.value)
          })
        }
      } else if (anim.type === 'set') {
        const attr = anim.attributeName
        if (geometricState[attr]) {
          geometricState[attr].push(parseFloat(anim.to))
        }
      }
    })

    // Calculate bounds envelope using extreme values
    const cxValues = [...new Set(geometricState.cx)]
    const cyValues = [...new Set(geometricState.cy)]
    const rValues = [...new Set(geometricState.r)]

    if (debug) {
      console.log(`    Circle envelope: cx=${cxValues}, cy=${cyValues}, r=${rValues}`)
    }

    // Calculate envelope bounds
    const minCx = Math.min(...cxValues)
    const maxCx = Math.max(...cxValues)
    const minCy = Math.min(...cyValues)
    const maxCy = Math.max(...cyValues)
    const maxR = Math.max(...rValues)

    // Calculate envelope using extreme combinations
    const envelopeMinX = minCx - maxR
    const envelopeMaxX = maxCx + maxR
    const envelopeMinY = minCy - maxR
    const envelopeMaxY = maxCy + maxR

    const envelopeBounds = {
      x: envelopeMinX,
      y: envelopeMinY,
      width: envelopeMaxX - envelopeMinX,
      height: envelopeMaxY - envelopeMinY
    }

    if (debug) {
      console.log(`    Circle envelope bounds: (${envelopeBounds.x}, ${envelopeBounds.y}) ${envelopeBounds.width}x${envelopeBounds.height}`)
    }

    updateGlobalBounds(envelopeBounds)

    // Handle non-circle animations normally
    nonAdditiveGeometricAnimations.forEach(anim => {
      if (anim.type === 'animateTransform' || anim.type === 'animateMotion' ||
          (anim.type === 'animate' && !['cx', 'cy', 'r', 'rx', 'ry'].includes(anim.attributeName)) ||
          (anim.type === 'set' && !['cx', 'cy', 'r', 'rx', 'ry'].includes(anim.attributeName))) {
        const animBounds = calculateSingleAnimationBounds(anim, baseBounds, debug)
        if (debug) {
          console.log(`    Non-circle animation ${anim.type}(${anim.attributeName || anim.transformType || 'motion'}) bounds:`, animBounds)
        }
        updateGlobalBounds(animBounds)
      }
    })
  } else {
    // For non-circle animations, use the original approach
    nonAdditiveGeometricAnimations.forEach(anim => {
      const animBounds = calculateSingleAnimationBounds(anim, baseBounds, debug)
      if (debug) {
        console.log(`    Geometric animation ${anim.type}(${anim.attributeName || anim.transformType || 'motion'}) bounds:`, animBounds)
      }
      updateGlobalBounds(animBounds)
    })
  }

  // Handle additive animations by combining their transforms
  if (additiveAnimations.length > 0) {
    const combinedBounds = calculateAdditiveAnimationBounds(additiveAnimations, baseBounds, debug)
    updateGlobalBounds(combinedBounds)
  }

  // Calculate intermediate geometric bounds
  let geometricBounds = baseBounds
  if (globalMinX !== Infinity) {
    geometricBounds = {
      x: globalMinX,
      y: globalMinY,
      width: globalMaxX - globalMinX,
      height: globalMaxY - globalMinY
    }

    if (debug) {
      console.log(`    Intermediate geometric bounds: (${geometricBounds.x}, ${geometricBounds.y}) ${geometricBounds.width}x${geometricBounds.height}`)
    }
  }

  // Now apply stroke-width animations to the geometric bounds
  strokeAnimations.forEach(anim => {
    const strokeValue = anim.type === 'set'
      ? parseFloat(anim.to)
      : Math.max(...anim.values.map(v => v.value))
    const halfStroke = strokeValue / 2

    // Apply stroke expansion to the geometric bounds
    const strokeExpandedBounds = {
      x: geometricBounds.x - halfStroke,
      y: geometricBounds.y - halfStroke,
      width: geometricBounds.width + strokeValue,
      height: geometricBounds.height + strokeValue
    }

    if (debug) {
      console.log(`    Stroke animation ${anim.type}(${anim.attributeName}) value=${strokeValue}, expanded geometric bounds: (${strokeExpandedBounds.x}, ${strokeExpandedBounds.y}) ${strokeExpandedBounds.width}x${strokeExpandedBounds.height}`)
    }

    updateGlobalBounds(strokeExpandedBounds)
  })

  // Handle other animations
  otherAnimations.forEach(anim => {
    const animBounds = calculateSingleAnimationBounds(anim, baseBounds, debug)
    if (debug) {
      console.log(`    Other animation ${anim.type}(${anim.attributeName || anim.transformType || 'motion'}) bounds:`, animBounds)
    }
    updateGlobalBounds(animBounds)
  })

  function updateGlobalBounds (bounds) {
    if (Array.isArray(bounds)) {
      bounds.forEach(b => {
        globalMinX = Math.min(globalMinX, b.x)
        globalMinY = Math.min(globalMinY, b.y)
        globalMaxX = Math.max(globalMaxX, b.x + b.width)
        globalMaxY = Math.max(globalMaxY, b.y + b.height)
      })
    } else {
      globalMinX = Math.min(globalMinX, bounds.x)
      globalMinY = Math.min(globalMinY, bounds.y)
      globalMaxX = Math.max(globalMaxX, bounds.x + bounds.width)
      globalMaxY = Math.max(globalMaxY, bounds.y + bounds.height)
    }
  }

  if (globalMinX === Infinity) {
    return baseBounds
  }

  return {
    x: globalMinX,
    y: globalMinY,
    width: globalMaxX - globalMinX,
    height: globalMaxY - globalMinY
  }
}

/**
 * Calculate bounds for a single animation
 */
function calculateSingleAnimationBounds (anim, baseBounds, debug = false) {
  if (anim.type === 'animateTransform') {
    return anim.transforms.map(transform =>
      transform.matrix.transformBounds(baseBounds)
    )
  } else if (anim.type === 'animate') {
    return anim.values.map(valueFrame => {
      if (valueFrame.normalizedValue && valueFrame.normalizedValue.type === 'pathData') {
        const pathBounds = valueFrame.normalizedValue.bounds
        return {
          x: pathBounds.minX,
          y: pathBounds.minY,
          width: pathBounds.maxX - pathBounds.minX,
          height: pathBounds.maxY - pathBounds.minY
        }
      } else {
        const adjustedBounds = { ...baseBounds }
        switch (anim.attributeName) {
          case 'x': adjustedBounds.x = valueFrame.value; break
          case 'y': adjustedBounds.y = valueFrame.value; break
          case 'width': adjustedBounds.width = valueFrame.value; break
          case 'height': adjustedBounds.height = valueFrame.value; break
          case 'cx':
            // For circles/ellipses - convert center to bounds
            adjustedBounds.x = valueFrame.value - (baseBounds.width / 2)
            break
          case 'cy':
            adjustedBounds.y = valueFrame.value - (baseBounds.height / 2)
            break
          case 'r':
            // For circles - radius affects both width and height
            adjustedBounds.width = valueFrame.value * 2
            adjustedBounds.height = valueFrame.value * 2
            adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - valueFrame.value
            adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - valueFrame.value
            break
          case 'rx':
            // For ellipses - horizontal radius
            adjustedBounds.width = valueFrame.value * 2
            adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - valueFrame.value
            break
          case 'ry':
            // For ellipses - vertical radius
            adjustedBounds.height = valueFrame.value * 2
            adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - valueFrame.value
            break
          case 'stroke-width':
            // Stroke-width is now handled separately in the main function
            break
          case 'opacity':
          case 'fill-opacity':
          case 'stroke-opacity':
            // Opacity animations don't affect geometric bounds
            // The bounds remain the same as base bounds
            break
        }
        return adjustedBounds
      }
    })
  } else if (anim.type === 'animateMotion') {
    const motionBounds = anim.expandedBounds || anim.motionBounds
    return {
      x: baseBounds.x + motionBounds.minX,
      y: baseBounds.y + motionBounds.minY,
      width: baseBounds.width + (motionBounds.maxX - motionBounds.minX),
      height: baseBounds.height + (motionBounds.maxY - motionBounds.minY)
    }
  } else if (anim.type === 'set') {
    // Handle set animations - they set a single value at a specific time
    const adjustedBounds = { ...baseBounds }
    const toValue = parseFloat(anim.to)

    switch (anim.attributeName) {
      case 'x': adjustedBounds.x = toValue; break
      case 'y': adjustedBounds.y = toValue; break
      case 'width': adjustedBounds.width = toValue; break
      case 'height': adjustedBounds.height = toValue; break
      case 'cx':
        adjustedBounds.x = toValue - (baseBounds.width / 2)
        break
      case 'cy':
        adjustedBounds.y = toValue - (baseBounds.height / 2)
        break
      case 'r':
        adjustedBounds.width = toValue * 2
        adjustedBounds.height = toValue * 2
        adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - toValue
        adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - toValue
        break
      case 'rx':
        adjustedBounds.width = toValue * 2
        adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - toValue
        break
      case 'ry':
        adjustedBounds.height = toValue * 2
        adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - toValue
        break
      case 'stroke-width':
        // Stroke-width is now handled separately in the main function
        // Just return base bounds here (this shouldn't be called)
        break
      case 'opacity':
      case 'fill-opacity':
      case 'stroke-opacity':
      case 'display':
      case 'visibility':
      case 'fill':
      case 'stroke':
        // These don't affect geometric bounds
        break
    }

    return adjustedBounds
  }

  return baseBounds
}

/**
 * Calculate bounds for additive animations by combining their transforms
 */
function calculateAdditiveAnimationBounds (additiveAnimations, baseBounds, debug = false) {
  // Get all time samples from all additive animations
  const allTimes = new Set()
  additiveAnimations.forEach(anim => {
    if (anim.type === 'animateTransform') {
      anim.transforms.forEach(transform => {
        allTimes.add(transform.time)
      })
    }
  })

  const timeArray = Array.from(allTimes).sort((a, b) => a - b)

  if (debug) {
    console.log(`      Processing ${timeArray.length} time samples for additive animations`)
  }

  const allBounds = []

  // For each time sample, combine all additive transforms
  timeArray.forEach(time => {
    let combinedMatrix = Matrix2D.identity()

    additiveAnimations.forEach(anim => {
      if (anim.type === 'animateTransform') {
        // Find the transform at this time (or closest)
        const transform = findTransformAtTime(anim.transforms, time)
        if (transform) {
          combinedMatrix = combinedMatrix.multiply(transform.matrix)
        }
      }
    })

    const transformedBounds = combinedMatrix.transformBounds(baseBounds)
    allBounds.push(transformedBounds)

    if (debug) {
      console.log(`      Time ${time}: combined bounds (${transformedBounds.x.toFixed(2)}, ${transformedBounds.y.toFixed(2)}) ${transformedBounds.width.toFixed(2)}x${transformedBounds.height.toFixed(2)}`)
    }
  })

  return allBounds
}

/**
 * Find the transform at a specific time (or interpolate)
 */
function findTransformAtTime (transforms, targetTime) {
  // Find exact match first
  const exactMatch = transforms.find(t => t.time === targetTime)
  if (exactMatch) return exactMatch

  // Find the transforms to interpolate between
  let before = null
  let after = null

  for (const transform of transforms) {
    if (transform.time <= targetTime) {
      if (!before || transform.time > before.time) {
        before = transform
      }
    }
    if (transform.time >= targetTime) {
      if (!after || transform.time < after.time) {
        after = transform
      }
    }
  }

  // Return the closest transform if we can't interpolate
  if (!before) return after
  if (!after) return before

  // For now, return the before transform (could implement interpolation here)
  return before
}

module.exports = {
  combineOverlappingAnimations,
  calculateSingleAnimationBounds,
  calculateAdditiveAnimationBounds
}

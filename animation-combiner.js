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
  }

  // Separate additive and non-additive animations
  const additiveAnimations = animations.filter(anim =>
    anim.type === 'animateTransform' && anim.additive
  )
  const nonAdditiveAnimations = animations.filter(anim =>
    anim.type !== 'animateTransform' || !anim.additive
  )

  let globalMinX = Infinity
  let globalMinY = Infinity
  let globalMaxX = -Infinity
  let globalMaxY = -Infinity

  // Handle non-additive animations independently
  nonAdditiveAnimations.forEach(anim => {
    const animBounds = calculateSingleAnimationBounds(anim, baseBounds, debug)
    updateGlobalBounds(animBounds)
  })

  // Handle additive animations by combining their transforms
  if (additiveAnimations.length > 0) {
    const combinedBounds = calculateAdditiveAnimationBounds(additiveAnimations, baseBounds, debug)
    updateGlobalBounds(combinedBounds)
  }

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

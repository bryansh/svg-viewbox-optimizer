/**
 * SVG Path Parser
 * Parses SVG path data and calculates bounding boxes for animateMotion elements
 */

/**
 * Parse SVG path data into commands
 */
function parsePath (pathData) {
  if (!pathData) return []

  const commands = []
  const regex = /([MmLlHhVvCcSsQqTtAaZz])|(-?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g
  const tokens = pathData.match(regex) || []

  let i = 0
  while (i < tokens.length) {
    const command = tokens[i]
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(command)) {
      const cmd = { type: command, args: [] }
      i++

      // Get expected number of arguments for this command
      const argCount = getCommandArgCount(command)

      // Handle zero-argument commands (like Z)
      if (argCount === 0) {
        commands.push(cmd)
      } else {
        // Handle commands that can repeat (like L can be L x1 y1 x2 y2...)
        let firstCommand = true
        while (i < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i])) {
          const args = []
          for (let j = 0; j < argCount && i < tokens.length && !/[MmLlHhVvCcSsQqTtAaZz]/.test(tokens[i]); j++) {
            args.push(parseFloat(tokens[i]))
            i++
          }
          if (args.length === argCount) {
            if (firstCommand) {
              cmd.args = args
              commands.push(cmd)
              firstCommand = false
            } else {
              // Create new command for repeated args (except for M which becomes L)
              const repeatType = command === 'M' ? 'L' : (command === 'm' ? 'l' : command)
              commands.push({ type: repeatType, args })
            }
          }
        }
      }
    } else {
      i++
    }
  }

  return commands
}

/**
 * Get expected argument count for path commands
 */
function getCommandArgCount (command) {
  switch (command.toUpperCase()) {
    case 'M':
    case 'L':
    case 'T': return 2
    case 'H':
    case 'V': return 1
    case 'C': return 6
    case 'S':
    case 'Q': return 4
    case 'A': return 7
    case 'Z': return 0
    default: return 0
  }
}

/**
 * Calculate bounding box of an SVG path
 */
function calculatePathBounds (pathData, debug = false) {
  const commands = parsePath(pathData)
  if (commands.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  let currentX = 0
  let currentY = 0
  let startX = 0
  let startY = 0
  let lastControlX = 0
  let lastControlY = 0

  function updateBounds (x, y) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  function updateBoundsForCubicBezier (x0, y0, x1, y1, x2, y2, x3, y3) {
    // Add start and end points
    updateBounds(x0, y0)
    updateBounds(x3, y3)

    // Find extrema of cubic bezier curve
    // For x: 3(1-t)²t(x1-x0) + 3(1-t)t²(x2-x1) + t³(x3-x2) = 0
    // Simplified: 3t²(x0-2x1+x2) + 6t(x1-x0) + 3(x0-x1) = 0

    // X extrema
    const ax = 3 * (x3 - 3 * x2 + 3 * x1 - x0)
    const bx = 6 * (x0 - 2 * x1 + x2)
    const cx = 3 * (x1 - x0)

    const discriminantX = bx * bx - 4 * ax * cx
    if (discriminantX >= 0 && ax !== 0) {
      const sqrtDiscX = Math.sqrt(discriminantX)
      const t1 = (-bx + sqrtDiscX) / (2 * ax)
      const t2 = (-bx - sqrtDiscX) / (2 * ax)

      if (t1 > 0 && t1 < 1) {
        const x = cubicBezierPoint(t1, x0, x1, x2, x3)
        updateBounds(x, cubicBezierPoint(t1, y0, y1, y2, y3))
      }
      if (t2 > 0 && t2 < 1) {
        const x = cubicBezierPoint(t2, x0, x1, x2, x3)
        updateBounds(x, cubicBezierPoint(t2, y0, y1, y2, y3))
      }
    }

    // Y extrema
    const ay = 3 * (y3 - 3 * y2 + 3 * y1 - y0)
    const by = 6 * (y0 - 2 * y1 + y2)
    const cy = 3 * (y1 - y0)

    const discriminantY = by * by - 4 * ay * cy
    if (discriminantY >= 0 && ay !== 0) {
      const sqrtDiscY = Math.sqrt(discriminantY)
      const t1 = (-by + sqrtDiscY) / (2 * ay)
      const t2 = (-by - sqrtDiscY) / (2 * ay)

      if (t1 > 0 && t1 < 1) {
        const y = cubicBezierPoint(t1, y0, y1, y2, y3)
        updateBounds(cubicBezierPoint(t1, x0, x1, x2, x3), y)
      }
      if (t2 > 0 && t2 < 1) {
        const y = cubicBezierPoint(t2, y0, y1, y2, y3)
        updateBounds(cubicBezierPoint(t2, x0, x1, x2, x3), y)
      }
    }
  }

  function updateBoundsForQuadraticBezier (x0, y0, x1, y1, x2, y2) {
    updateBounds(x0, y0)
    updateBounds(x2, y2)

    // For quadratic bezier, extrema occur at t = (P0 - P1) / (P0 - 2*P1 + P2)
    const tx = (x0 - x1) / (x0 - 2 * x1 + x2)
    const ty = (y0 - y1) / (y0 - 2 * y1 + y2)

    if (tx > 0 && tx < 1) {
      const x = quadraticBezierPoint(tx, x0, x1, x2)
      const y = quadraticBezierPoint(tx, y0, y1, y2)
      updateBounds(x, y)
    }

    if (ty > 0 && ty < 1) {
      const x = quadraticBezierPoint(ty, x0, x1, x2)
      const y = quadraticBezierPoint(ty, y0, y1, y2)
      updateBounds(x, y)
    }
  }

  if (debug) {
    console.log(`    Parsing path with ${commands.length} commands`)
  }

  commands.forEach((cmd, index) => {
    const isRelative = cmd.type === cmd.type.toLowerCase()
    const args = cmd.args

    if (debug) {
      console.log(`      Command ${index}: ${cmd.type} ${args.join(' ')}`)
    }

    switch (cmd.type.toUpperCase()) {
      case 'M': // Move to
        currentX = isRelative ? currentX + args[0] : args[0]
        currentY = isRelative ? currentY + args[1] : args[1]
        startX = currentX
        startY = currentY
        updateBounds(currentX, currentY)
        break

      case 'L': // Line to
        currentX = isRelative ? currentX + args[0] : args[0]
        currentY = isRelative ? currentY + args[1] : args[1]
        updateBounds(currentX, currentY)
        break

      case 'H': // Horizontal line
        currentX = isRelative ? currentX + args[0] : args[0]
        updateBounds(currentX, currentY)
        break

      case 'V': // Vertical line
        currentY = isRelative ? currentY + args[0] : args[0]
        updateBounds(currentX, currentY)
        break

      case 'C': { // Cubic bezier curve
        const c1x = isRelative ? currentX + args[0] : args[0]
        const c1y = isRelative ? currentY + args[1] : args[1]
        const c2x = isRelative ? currentX + args[2] : args[2]
        const c2y = isRelative ? currentY + args[3] : args[3]
        const endX = isRelative ? currentX + args[4] : args[4]
        const endY = isRelative ? currentY + args[5] : args[5]

        updateBoundsForCubicBezier(currentX, currentY, c1x, c1y, c2x, c2y, endX, endY)

        lastControlX = c2x
        lastControlY = c2y
        currentX = endX
        currentY = endY
        break
      }

      case 'S': { // Smooth cubic bezier
        const sc1x = 2 * currentX - lastControlX
        const sc1y = 2 * currentY - lastControlY
        const sc2x = isRelative ? currentX + args[0] : args[0]
        const sc2y = isRelative ? currentY + args[1] : args[1]
        const sendX = isRelative ? currentX + args[2] : args[2]
        const sendY = isRelative ? currentY + args[3] : args[3]

        updateBoundsForCubicBezier(currentX, currentY, sc1x, sc1y, sc2x, sc2y, sendX, sendY)

        lastControlX = sc2x
        lastControlY = sc2y
        currentX = sendX
        currentY = sendY
        break
      }

      case 'Q': { // Quadratic bezier
        const qc1x = isRelative ? currentX + args[0] : args[0]
        const qc1y = isRelative ? currentY + args[1] : args[1]
        const qendX = isRelative ? currentX + args[2] : args[2]
        const qendY = isRelative ? currentY + args[3] : args[3]

        updateBoundsForQuadraticBezier(currentX, currentY, qc1x, qc1y, qendX, qendY)

        lastControlX = qc1x
        lastControlY = qc1y
        currentX = qendX
        currentY = qendY
        break
      }

      case 'T': { // Smooth quadratic bezier
        const tc1x = 2 * currentX - lastControlX
        const tc1y = 2 * currentY - lastControlY
        const tendX = isRelative ? currentX + args[0] : args[0]
        const tendY = isRelative ? currentY + args[1] : args[1]

        updateBoundsForQuadraticBezier(currentX, currentY, tc1x, tc1y, tendX, tendY)

        lastControlX = tc1x
        lastControlY = tc1y
        currentX = tendX
        currentY = tendY
        break
      }

      case 'A': { // Arc - simplified bounding box (complex to compute exactly)
        const rx = Math.abs(args[0])
        const ry = Math.abs(args[1])
        const aendX = isRelative ? currentX + args[5] : args[5]
        const aendY = isRelative ? currentY + args[6] : args[6]

        // Approximate arc bounds (conservative estimate)
        const centerX = (currentX + aendX) / 2
        const centerY = (currentY + aendY) / 2
        updateBounds(centerX - rx, centerY - ry)
        updateBounds(centerX + rx, centerY + ry)
        updateBounds(aendX, aendY)

        currentX = aendX
        currentY = aendY
        break
      }

      case 'Z': // Close path
        currentX = startX
        currentY = startY
        updateBounds(currentX, currentY)
        break
    }
  })

  // If no valid bounds were found, return zero bounds
  if (minX === Infinity) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  if (debug) {
    console.log(`    Path bounds: (${minX.toFixed(2)}, ${minY.toFixed(2)}) to (${maxX.toFixed(2)}, ${maxY.toFixed(2)})`)
  }

  return { minX, maxX, minY, maxY }
}

/**
 * Calculate point on cubic bezier curve at parameter t
 */
function cubicBezierPoint (t, p0, p1, p2, p3) {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

/**
 * Calculate point on quadratic bezier curve at parameter t
 */
function quadraticBezierPoint (t, p0, p1, p2) {
  const mt = 1 - t
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2
}

/**
 * Parse animateMotion values attribute (coordinate pairs)
 */
function parseMotionValues (valuesString) {
  if (!valuesString) return []

  const coords = []
  const pairs = valuesString.split(';')

  pairs.forEach(pair => {
    const [x, y] = pair.trim().split(/[,\s]+/).map(parseFloat)
    if (!isNaN(x) && !isNaN(y)) {
      coords.push({ x, y })
    }
  })

  return coords
}

/**
 * Calculate bounds for motion values (coordinate pairs)
 */
function calculateMotionValuesBounds (valuesString, debug = false) {
  const coords = parseMotionValues(valuesString)

  if (coords.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }

  let minX = coords[0].x
  let maxX = coords[0].x
  let minY = coords[0].y
  let maxY = coords[0].y

  coords.forEach(coord => {
    minX = Math.min(minX, coord.x)
    maxX = Math.max(maxX, coord.x)
    minY = Math.min(minY, coord.y)
    maxY = Math.max(maxY, coord.y)
  })

  if (debug) {
    console.log(`    Motion values bounds: (${minX.toFixed(2)}, ${minY.toFixed(2)}) to (${maxX.toFixed(2)}, ${maxY.toFixed(2)})`)
  }

  return { minX, maxX, minY, maxY }
}

module.exports = {
  parsePath,
  calculatePathBounds,
  calculateMotionValuesBounds,
  parseMotionValues
}

/**
 * Browser-compatible SVG analysis module
 *
 * Main orchestrator for SVG viewBox optimization analysis.
 * Coordinates between visibility checking, bounds calculation, and animation analysis.
 */

window.SVGAnalyzer = (function () {
  'use strict'

  /**
   * Analyze SVG and calculate optimization bounds
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Analysis result with bounds and element information
   */
  function analyzeSVG (debug = false) {
    const svg = document.querySelector('svg')

    if (!svg) {
      throw new Error('No SVG found')
    }

    // Get original viewBox
    const originalViewBox = svg.getAttribute('viewBox')

    if (!originalViewBox) {
      return { error: 'No viewBox attribute found. Please add a viewBox to your SVG.' }
    }

    const [, , origWidth, origHeight] = originalViewBox.split(' ').map(Number)

    if (debug) {
      console.log('=== SVG ViewBox Optimization (Modular Architecture) ===')
      console.log(`Original viewBox: ${originalViewBox}`)
    }

    // Initialize bounds tracking
    let globalMinX = Infinity
    let globalMinY = Infinity
    let globalMaxX = -Infinity
    let globalMaxY = -Infinity
    let elementCount = 0
    let animationCount = 0
    let effectsCount = 0
    const elements = []

    // Process use elements first
    const useElements = svg.querySelectorAll('use')
    if (debug) {
      console.log(`Processing ${useElements.length} use elements`)
    }

    useElements.forEach(useEl => {
      if (!window.VisibilityChecker.shouldIncludeElement(useEl, svg, debug)) return

      const href = useEl.getAttribute('xlink:href') || useEl.getAttribute('href')
      if (!href || !href.startsWith('#')) return

      const referencedSymbol = svg.querySelector(href)
      if (!referencedSymbol) return

      // Handle container symbols by resolving the full chain
      if (isContainerSymbol(referencedSymbol)) {
        if (debug) {
          console.log(`  Processing container symbol ${href} - resolving chain`)
        }

        // Get the cumulative transform matrix for the container use element
        const containerMatrix = window.calculateCumulativeTransform ? window.calculateCumulativeTransform(useEl, svg) : null

        // Extract root-level use positioning attributes
        const rootUseTransform = createRootUseTransform(useEl, referencedSymbol, debug)

        // Recursively resolve the symbol chain
        const resolvedElements = resolveSymbolChain(referencedSymbol, svg, containerMatrix, new Set(), debug)

        resolvedElements.forEach(resolved => {
          const bounds = window.BoundsCalculator.getElementBounds(resolved.element, debug)
          if (bounds.width === 0 && bounds.height === 0) return

          // Apply accumulated transform from symbol chain
          let finalBounds = bounds
          if (resolved.transform && resolved.transform.transformBounds) {
            finalBounds = resolved.transform.transformBounds(bounds)
          }

          // Apply root-level use element positioning
          if (rootUseTransform && rootUseTransform.transformBounds) {
            finalBounds = rootUseTransform.transformBounds(finalBounds)
            if (debug) {
              console.log(`    Applied root use transform: (${bounds.x},${bounds.y}) ${bounds.width}x${bounds.height} -> (${finalBounds.x.toFixed(2)},${finalBounds.y.toFixed(2)}) ${finalBounds.width.toFixed(2)}x${finalBounds.height.toFixed(2)}`)
            }
          }

          updateGlobalBounds(finalBounds)
          elementCount++

          // Analyze animations on the original use element
          const animations = analyzeElementAnimations(useEl, svg, debug)
          if (animations.length > 0) {
            animationCount += animations.length
            expandBoundsForAnimations(animations, finalBounds, debug)
          }

          elements.push({
            type: 'use',
            href,
            bounds: finalBounds,
            animations,
            hasEffects: false,
            resolvedFrom: resolved.element.tagName.toLowerCase()
          })
        })
      } else {
        // Process direct symbol reference
        // Get bounds from the use element itself, not the symbol
        const bounds = window.BoundsCalculator.getElementBounds(useEl, debug)
        if (bounds.width === 0 && bounds.height === 0) return

        updateGlobalBounds(bounds)
        elementCount++

        // Analyze animations
        const animations = analyzeElementAnimations(useEl, svg, debug)
        if (animations.length > 0) {
          animationCount += animations.length

          // Expand bounds to include animation extremes
          expandBoundsForAnimations(animations, bounds, debug)
        }

        elements.push({
          type: 'use',
          href,
          bounds,
          animations,
          hasEffects: false
        })
      }
    })

    // First, handle switch elements and get active children
    let activeElementsFromSwitches = []
    if (window.SwitchEvaluator) {
      activeElementsFromSwitches = window.SwitchEvaluator.getActiveElementsFromSwitches(svg, debug)
    }

    // Process direct visual elements (excluding those inside switch elements)
    const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject, svg')

    if (debug) {
      console.log(`Processing ${visualElements.length} visual elements + ${activeElementsFromSwitches.length} switch-selected elements`)
    }

    // Combine regular elements with active switch elements
    const allElementsToProcess = []

    // Add regular visual elements (with conditional filtering)
    visualElements.forEach(element => {
      // Check visibility
      if (!window.VisibilityChecker.shouldIncludeElement(element, svg, debug)) return

      // Check conditional attributes (requiredFeatures, etc.) and switch membership
      if (window.SwitchEvaluator && !window.SwitchEvaluator.shouldIncludeElement(element, debug)) return

      allElementsToProcess.push(element)
    })

    // Add active elements from switch evaluation
    activeElementsFromSwitches.forEach(element => {
      // These are already conditionally selected, but still check visibility
      if (window.VisibilityChecker.shouldIncludeElement(element, svg, debug)) {
        allElementsToProcess.push(element)
      }
    })

    allElementsToProcess.forEach(element => {
      const tagName = element.tagName.toLowerCase()

      // Skip non-visual elements that don't contribute to bounds
      if (tagName === 'view' || tagName === 'cursor') {
        if (debug) {
          console.log(`  Skipping non-visual element: ${tagName}`)
        }
        return
      }

      // Handle nested SVG elements specially
      if (tagName === 'svg') {
        if (debug) {
          console.log('  Processing nested SVG element')
        }
        processNestedSVG(element, svg, debug)
        return
      }

      const bounds = window.BoundsCalculator.getElementBounds(element, debug)

      // Skip elements with zero dimensions unless they have animations
      const hasAnimations = element.querySelector('animateTransform, animate, animateMotion') !== null
      if ((bounds.width === 0 || bounds.height === 0) && !hasAnimations) {
        if (debug) {
          console.log(`  Skipping ${tagName} with zero dimensions and no animations`)
        }
        return
      }

      // Apply transforms to bounds
      const transformMatrix = window.calculateCumulativeTransform ? window.calculateCumulativeTransform(element, svg) : null
      const transformedBounds = transformMatrix ? transformMatrix.transformBounds(bounds) : bounds

      if (debug && transformMatrix && !transformMatrix.isIdentity()) {
        console.log(`  Applied transform matrix: bounds (${bounds.x},${bounds.y},${bounds.width},${bounds.height}) -> (${transformedBounds.x.toFixed(2)},${transformedBounds.y.toFixed(2)},${transformedBounds.width.toFixed(2)},${transformedBounds.height.toFixed(2)})`)
      }

      // Analyze animations first to see if element moves
      const animations = analyzeElementAnimations(element, svg, debug)
      const hasMotionAnimation = animations.some(anim => anim.type === 'animateMotion')

      // For elements with motion animation, don't include static bounds
      if (!hasMotionAnimation) {
        updateGlobalBounds(transformedBounds)
      }
      elementCount++

      // Analyze effects first to determine if we need to apply them to animated bounds
      const effects = window.analyzeElementEffects ? window.analyzeElementEffects(element, svg, debug) : { hasAnyEffects: false }
      if (effects.hasAnyEffects) {
        effectsCount++
      }

      if (animations.length > 0) {
        animationCount += animations.length

        // Combine overlapping animations (handles additive animations properly)
        if (typeof window.combineOverlappingAnimations === 'function') {
          const animatedBounds = window.combineOverlappingAnimations(animations, bounds, debug)
          // Apply transform to the animated bounds if needed
          const finalAnimatedBounds = transformMatrix ? transformMatrix.transformBounds(animatedBounds) : animatedBounds

          // If element has effects, apply them to the animated bounds
          if (effects.hasAnyEffects) {
            const effectsBounds = expandBoundsForEffects(effects, finalAnimatedBounds, debug)
            updateGlobalBounds(effectsBounds)
          } else {
            updateGlobalBounds(finalAnimatedBounds)
          }
        } else {
          // Fallback to basic expansion
          expandBoundsForAnimations(animations, bounds, debug)

          // Apply effects to animated bounds if present
          if (effects.hasAnyEffects) {
            const effectsBounds = expandBoundsForEffects(effects, transformedBounds, debug)
            updateGlobalBounds(effectsBounds)
          }
        }
      } else if (effects.hasAnyEffects) {
        // No animations, just apply effects to transformed bounds
        const effectsBounds = expandBoundsForEffects(effects, transformedBounds, debug)
        updateGlobalBounds(effectsBounds)
      }

      elements.push({
        type: tagName,
        bounds: transformedBounds,
        animations,
        hasEffects: effects.hasAnyEffects
      })
    })

    // Helper functions
    function updateGlobalBounds (bounds) {
      globalMinX = Math.min(globalMinX, bounds.x)
      globalMinY = Math.min(globalMinY, bounds.y)
      globalMaxX = Math.max(globalMaxX, bounds.x + bounds.width)
      globalMaxY = Math.max(globalMaxY, bounds.y + bounds.height)
    }

    function expandBoundsForEffects (effects, baseBounds, debug) {
      if (debug) {
        console.log('  Expanding bounds for effects')
      }

      let expandedBounds = { ...baseBounds }

      // Handle filter effects
      if (effects.filter && effects.filter.hasFilter) {
        const filterExpansion = effects.filter.expansion

        if (filterExpansion.isPixelBased) {
          // Pixel-based expansion (from blur, offset, etc.)
          expandedBounds = {
            x: baseBounds.x - filterExpansion.x,
            y: baseBounds.y - filterExpansion.y,
            width: baseBounds.width + filterExpansion.width,
            height: baseBounds.height + filterExpansion.height
          }
        } else {
          // Percentage-based expansion (from filter region)
          const widthExpansion = baseBounds.width * filterExpansion.width
          const heightExpansion = baseBounds.height * filterExpansion.height
          const xExpansion = baseBounds.width * filterExpansion.x
          const yExpansion = baseBounds.height * filterExpansion.y

          expandedBounds = {
            x: baseBounds.x - xExpansion,
            y: baseBounds.y - yExpansion,
            width: baseBounds.width + widthExpansion,
            height: baseBounds.height + heightExpansion
          }
        }

        if (debug) {
          console.log(`    Filter expanded bounds: x=${expandedBounds.x.toFixed(2)}, y=${expandedBounds.y.toFixed(2)}, w=${expandedBounds.width.toFixed(2)}, h=${expandedBounds.height.toFixed(2)}`)
        }
      }

      // For mask and clipPath effects, we conservatively preserve element bounds
      // since they don't expand the visual area, they just hide parts of it

      return expandedBounds
    }

    function expandBoundsForAnimations (animations, baseBounds, debug) {
      if (debug) {
        console.log(`  Expanding bounds for ${animations.length} animations`)
      }

      animations.forEach(animation => {
        if (animation.type === 'animateTransform' && animation.transforms) {
          // Process each transform in the animation
          animation.transforms.forEach(transform => {
            const matrix = transform.matrix
            if (matrix && typeof matrix.transformBounds === 'function') {
              const animatedBounds = matrix.transformBounds(baseBounds)

              if (debug) {
                console.log(`    Transform animated bounds: x=${animatedBounds.x.toFixed(2)}, y=${animatedBounds.y.toFixed(2)}, w=${animatedBounds.width.toFixed(2)}, h=${animatedBounds.height.toFixed(2)}`)
              }

              updateGlobalBounds(animatedBounds)
            }
          })
        } else if (animation.type === 'animate' && animation.values) {
          // Process attribute animations
          animation.values.forEach(valueFrame => {
            let adjustedBounds = { ...baseBounds }

            // Handle different attribute types
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
              case 'stroke-width': {
                // Stroke extends bounds outward by half stroke width on all sides
                const strokeWidth = valueFrame.value
                const halfStroke = strokeWidth / 2
                adjustedBounds.x -= halfStroke
                adjustedBounds.y -= halfStroke
                adjustedBounds.width += strokeWidth
                adjustedBounds.height += strokeWidth
                break
              }
              case 'opacity':
              case 'fill-opacity':
              case 'stroke-opacity':
                // Opacity animations don't affect geometric bounds
                // The bounds remain the same as base bounds
                break
              case 'd':
                // Path morphing - use normalized bounds if available
                if (valueFrame.normalizedValue && valueFrame.normalizedValue.bounds) {
                  const pathBounds = valueFrame.normalizedValue.bounds
                  adjustedBounds = {
                    x: pathBounds.minX,
                    y: pathBounds.minY,
                    width: pathBounds.maxX - pathBounds.minX,
                    height: pathBounds.maxY - pathBounds.minY
                  }
                }
                break
            }

            if (debug) {
              console.log(`    Attribute animated bounds: x=${adjustedBounds.x.toFixed(2)}, y=${adjustedBounds.y.toFixed(2)}, w=${adjustedBounds.width.toFixed(2)}, h=${adjustedBounds.height.toFixed(2)}`)
            }

            updateGlobalBounds(adjustedBounds)
          })
        } else if (animation.type === 'animateMotion' && animation.motionBounds) {
          // Process motion path animations
          const motionBounds = animation.expandedBounds || animation.motionBounds

          // For animateMotion, the element moves along the path
          // The motion bounds represent where the element's reference point travels
          // We need to expand these bounds by the element's size to get the final visual bounds

          // Calculate the final bounds by positioning the element at each motion point
          // The motion bounds represent where the element's reference point travels
          const expandedBounds = {
            x: motionBounds.minX,
            y: motionBounds.minY,
            width: (motionBounds.maxX - motionBounds.minX) + baseBounds.width,
            height: (motionBounds.maxY - motionBounds.minY) + baseBounds.height
          }

          if (debug) {
            console.log(`    Motion path bounds: (${motionBounds.minX},${motionBounds.minY}) to (${motionBounds.maxX},${motionBounds.maxY})`)
            console.log(`    Element size: ${baseBounds.width}x${baseBounds.height}`)
            console.log(`    Motion animated bounds: x=${expandedBounds.x.toFixed(2)}, y=${expandedBounds.y.toFixed(2)}, w=${expandedBounds.width.toFixed(2)}, h=${expandedBounds.height.toFixed(2)}`)
          }

          updateGlobalBounds(expandedBounds)
        } else if (animation.type === 'set') {
          // Process set animations - they set a single value at a specific time
          const adjustedBounds = { ...baseBounds }

          // Handle different attribute types (same logic as animate)
          switch (animation.attributeName) {
            case 'x':
              adjustedBounds.x = parseFloat(animation.to)
              break
            case 'y':
              adjustedBounds.y = parseFloat(animation.to)
              break
            case 'width':
              adjustedBounds.width = parseFloat(animation.to)
              break
            case 'height':
              adjustedBounds.height = parseFloat(animation.to)
              break
            case 'cx':
              adjustedBounds.x = parseFloat(animation.to) - (baseBounds.width / 2)
              break
            case 'cy':
              adjustedBounds.y = parseFloat(animation.to) - (baseBounds.height / 2)
              break
            case 'r': {
              const radius = parseFloat(animation.to)
              adjustedBounds.width = radius * 2
              adjustedBounds.height = radius * 2
              adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - radius
              adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - radius
              break
            }
            case 'rx': {
              const rxRadius = parseFloat(animation.to)
              adjustedBounds.width = rxRadius * 2
              adjustedBounds.x = baseBounds.x + baseBounds.width / 2 - rxRadius
              break
            }
            case 'ry': {
              const ryRadius = parseFloat(animation.to)
              adjustedBounds.height = ryRadius * 2
              adjustedBounds.y = baseBounds.y + baseBounds.height / 2 - ryRadius
              break
            }
            case 'stroke-width': {
              const setStrokeWidth = parseFloat(animation.to)
              const setHalfStroke = setStrokeWidth / 2
              adjustedBounds.x -= setHalfStroke
              adjustedBounds.y -= setHalfStroke
              adjustedBounds.width += setStrokeWidth
              adjustedBounds.height += setStrokeWidth
              break
            }
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

          if (debug && ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'stroke-width'].includes(animation.attributeName)) {
            console.log(`    Set ${animation.attributeName}=${animation.to} bounds: x=${adjustedBounds.x.toFixed(2)}, y=${adjustedBounds.y.toFixed(2)}, w=${adjustedBounds.width.toFixed(2)}, h=${adjustedBounds.height.toFixed(2)}`)
          }

          updateGlobalBounds(adjustedBounds)
        } else if (animation.isCSSAnimation && animation.expansion) {
          // Process CSS animation bounds expansion
          const cssExpandedBounds = {
            x: baseBounds.x + animation.expansion.x,
            y: baseBounds.y + animation.expansion.y,
            width: baseBounds.width + animation.expansion.width,
            height: baseBounds.height + animation.expansion.height
          }

          if (debug) {
            console.log(`    CSS animation '${animation.animationName}' bounds expansion: dx=${animation.expansion.x.toFixed(2)}, dy=${animation.expansion.y.toFixed(2)}, dw=${animation.expansion.width.toFixed(2)}, dh=${animation.expansion.height.toFixed(2)}`)
            console.log(`    CSS animated bounds: x=${cssExpandedBounds.x.toFixed(2)}, y=${cssExpandedBounds.y.toFixed(2)}, w=${cssExpandedBounds.width.toFixed(2)}, h=${cssExpandedBounds.height.toFixed(2)}`)
          }

          updateGlobalBounds(cssExpandedBounds)
        }
      })
    }

    function isContainerSymbol (symbolElement) {
      const nestedUseElements = symbolElement.querySelectorAll('use')
      return nestedUseElements.length > 0
    }

    /**
     * Create transform matrix for root-level use element positioning
     * Handles x, y, width, height attributes and viewBox scaling
     */
    function createRootUseTransform (useElement, referencedSymbol, debug) {
      const x = parseFloat(useElement.getAttribute('x') || '0')
      const y = parseFloat(useElement.getAttribute('y') || '0')
      const width = parseFloat(useElement.getAttribute('width') || '0')
      const height = parseFloat(useElement.getAttribute('height') || '0')

      // Get target viewBox for scaling calculations
      const targetViewBox = referencedSymbol.getAttribute('viewBox')

      if (debug) {
        console.log(`    Root use transform: x=${x}, y=${y}, width=${width}, height=${height}, targetViewBox=${targetViewBox}`)
      }

      // If no positioning attributes, return null
      if (x === 0 && y === 0 && width === 0 && height === 0) {
        return null
      }

      return {
        type: 'root-use-transform',
        x,
        y,
        width,
        height,
        targetViewBox,
        transformBounds: function (bounds) {
          // Start with translation
          const transformedBounds = {
            x: bounds.x + this.x,
            y: bounds.y + this.y,
            width: bounds.width,
            height: bounds.height
          }

          // Apply scaling if width/height are specified and we have a viewBox
          if (this.width > 0 && this.height > 0 && this.targetViewBox) {
            const viewBox = this.targetViewBox.split(' ').map(Number)
            if (viewBox.length >= 4) {
              const vbWidth = viewBox[2]
              const vbHeight = viewBox[3]
              if (vbWidth > 0 && vbHeight > 0) {
                const scaleX = this.width / vbWidth
                const scaleY = this.height / vbHeight

                // Scale the bounds
                transformedBounds.width *= scaleX
                transformedBounds.height *= scaleY

                // Adjust position for scaling (scaling happens around the origin)
                transformedBounds.x = this.x + (bounds.x * scaleX)
                transformedBounds.y = this.y + (bounds.y * scaleY)
              }
            }
          }

          return transformedBounds
        }
      }
    }

    /**
     * Recursively resolve symbol chains and get all concrete elements
     * @param {Element} symbolElement - The symbol to resolve
     * @param {Element} svg - Root SVG element
     * @param {Object} transform - Accumulated transform from parent uses
     * @param {Set} visited - Set of visited symbol IDs to prevent infinite loops
     * @param {boolean} debug - Enable debug logging
     * @returns {Array} Array of resolved element bounds with transforms
     */
    function resolveSymbolChain (symbolElement, svg, transform, visited = new Set(), debug = false) {
      const symbolId = symbolElement.getAttribute('id')

      // Prevent infinite recursion
      if (visited.has(symbolId)) {
        if (debug) {
          console.log(`  Circular reference detected for symbol #${symbolId}`)
        }
        return []
      }

      visited.add(symbolId)
      const resolvedElements = []

      // Get all child elements in the symbol
      const children = symbolElement.children

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const tagName = child.tagName.toLowerCase()

        if (tagName === 'use') {
          // Resolve the referenced symbol
          const href = child.getAttribute('xlink:href') || child.getAttribute('href')
          if (!href || !href.startsWith('#')) continue

          const referencedElement = svg.querySelector(href)
          if (!referencedElement) continue

          // Calculate transform for this use element (considering x, y, width, height attributes)
          const x = parseFloat(child.getAttribute('x') || '0')
          const y = parseFloat(child.getAttribute('y') || '0')
          const width = parseFloat(child.getAttribute('width') || '0')
          const height = parseFloat(child.getAttribute('height') || '0')

          // Create transform matrix for use element positioning
          let useTransform = null
          if (x !== 0 || y !== 0 || (width > 0 && height > 0)) {
            // For now, create a simple transform object that can be handled later
            useTransform = {
              type: 'use-transform',
              x,
              y,
              width,
              height,
              targetViewBox: referencedElement.getAttribute('viewBox'),
              transformBounds: function (bounds) {
                // Apply translation
                const transformedBounds = {
                  x: bounds.x + this.x,
                  y: bounds.y + this.y,
                  width: bounds.width,
                  height: bounds.height
                }

                // Apply scaling if width/height are specified
                if (this.width > 0 && this.height > 0 && this.targetViewBox) {
                  const viewBox = this.targetViewBox.split(' ').map(Number)
                  const vbWidth = viewBox[2]
                  const vbHeight = viewBox[3]
                  if (vbWidth > 0 && vbHeight > 0) {
                    const scaleX = this.width / vbWidth
                    const scaleY = this.height / vbHeight
                    transformedBounds.width *= scaleX
                    transformedBounds.height *= scaleY
                  }
                }

                return transformedBounds
              }
            }
          }

          // Combine with parent transform
          const combinedTransform = combineTransforms(transform, useTransform)

          if (referencedElement.tagName.toLowerCase() === 'symbol') {
            // Recursively resolve nested symbol
            const nestedElements = resolveSymbolChain(
              referencedElement,
              svg,
              combinedTransform,
              new Set(visited),
              debug
            )
            resolvedElements.push(...nestedElements)
          } else {
            // Regular element referenced by use
            resolvedElements.push({
              element: referencedElement,
              transform: combinedTransform
            })
          }
        } else if (tagName !== 'defs' && tagName !== 'style' && tagName !== 'script') {
          // Direct visual element in the symbol
          resolvedElements.push({
            element: child,
            transform
          })
        }
      }

      return resolvedElements
    }

    /**
     * Combine two transform matrices
     */
    function combineTransforms (t1, t2) {
      if (!t1) return t2
      if (!t2) return t1

      // If both have matrix multiply methods
      if (t1.multiply && t2.multiply) {
        return t1.multiply(t2)
      }

      // Create a combined transform that applies both
      return {
        type: 'combined-transform',
        t1,
        t2,
        transformBounds: function (bounds) {
          let result = bounds
          if (this.t1 && this.t1.transformBounds) {
            result = this.t1.transformBounds(result)
          }
          if (this.t2 && this.t2.transformBounds) {
            result = this.t2.transformBounds(result)
          }
          return result
        }
      }
    }

    function analyzeElementAnimations (element, svg, debug) {
      let animations = []

      // Use the sophisticated SVG animation analyzer that was injected
      if (typeof window.findElementAnimations === 'function') {
        animations = window.findElementAnimations(element, svg, debug)
      } else {
        // Fallback to simple SVG animation detection
        const animationElements = element.querySelectorAll('animateTransform, animate, animateMotion')
        animationElements.forEach(anim => {
          if (anim.parentElement === element) {
            animations.push({
              type: anim.tagName.toLowerCase(),
              element: anim
            })
          }
        })
      }

      // Check for CSS animations using the CSS animation analyzer
      if (typeof window.CSSAnimationAnalyzer === 'function') {
        const cssAnimationAnalyzer = new window.CSSAnimationAnalyzer(document)

        // Get element's base bounds for CSS animation analysis
        const baseBounds = window.BoundsCalculator.getElementBounds(element, debug)

        // Analyze CSS animations for this element
        const cssAnimationResult = cssAnimationAnalyzer.analyzeElementAnimations(element, baseBounds, debug)

        if (cssAnimationResult.hasAnimations) {
          // Convert CSS animation result to match SVG animation format
          animations.push({
            type: 'css-animation',
            animationName: cssAnimationResult.animationName,
            keyframes: cssAnimationResult.keyframes,
            expansion: cssAnimationResult.expansion,
            isCSSAnimation: true
          })
        }
      }

      return animations
    }

    function processNestedSVGWithTransform (nestedSvg, rootSvg, parentTransform, debug) {
      // Calculate coordinate transformation for this nested SVG level
      const nestedTransform = window.BoundsCalculator.calculateNestedSVGTransform(nestedSvg, debug)

      // Combine with parent transform (accumulated transformation)
      const combinedTransform = {
        translateX: parentTransform.translateX + nestedTransform.translateX * parentTransform.scaleX,
        translateY: parentTransform.translateY + nestedTransform.translateY * parentTransform.scaleY,
        scaleX: parentTransform.scaleX * nestedTransform.scaleX,
        scaleY: parentTransform.scaleY * nestedTransform.scaleY
      }

      if (debug) {
        console.log(`  Deeply nested SVG combined transform: translateX=${combinedTransform.translateX}, translateY=${combinedTransform.translateY}, scaleX=${combinedTransform.scaleX}, scaleY=${combinedTransform.scaleY}`)
      }

      // Process all child elements within this deeply nested SVG
      const childElements = nestedSvg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject, svg')

      childElements.forEach(childElement => {
        if (!window.VisibilityChecker.shouldIncludeElement(childElement, nestedSvg, debug)) return

        const tagName = childElement.tagName.toLowerCase()

        // Handle even deeper nesting recursively
        if (tagName === 'svg') {
          if (debug) {
            console.log('  Processing even deeper nested SVG element')
          }
          processNestedSVGWithTransform(childElement, rootSvg, combinedTransform, debug)
          return
        }

        // Get bounds of the child element in its local coordinate system
        const localBounds = window.BoundsCalculator.getElementBounds(childElement, debug)

        if (localBounds.width === 0 && localBounds.height === 0) return

        // Apply accumulated nested SVG coordinate transformation
        const transformedBounds = window.BoundsCalculator.applyNestedSVGTransform(localBounds, combinedTransform, debug)

        updateGlobalBounds(transformedBounds)
        elementCount++

        // Analyze animations (calculate in local space, then transform)
        const animations = analyzeElementAnimations(childElement, nestedSvg, debug)
        if (animations.length > 0) {
          animationCount += animations.length

          // Calculate animated bounds in local coordinate space first
          if (typeof window.combineOverlappingAnimations === 'function') {
            const localAnimatedBounds = window.combineOverlappingAnimations(animations, localBounds, debug)
            // Then apply the combined transform to the animated bounds
            const finalAnimatedBounds = window.BoundsCalculator.applyNestedSVGTransform(localAnimatedBounds, combinedTransform, debug)
            updateGlobalBounds(finalAnimatedBounds)
          } else {
            // Fallback: apply transform to animated bounds
            expandBoundsForAnimations(animations, transformedBounds, debug)
          }
        }

        // Analyze effects
        const effects = window.analyzeElementEffects ? window.analyzeElementEffects(childElement, nestedSvg, debug) : { hasAnyEffects: false }
        if (effects.hasAnyEffects) {
          effectsCount++

          const effectsBounds = expandBoundsForEffects(effects, transformedBounds, debug)
          updateGlobalBounds(effectsBounds)
        }

        elements.push({
          type: tagName,
          bounds: transformedBounds,
          animations,
          hasEffects: effects.hasAnyEffects,
          nested: true,
          deeplyNested: true
        })
      })
    }

    function processNestedSVG (nestedSvg, rootSvg, debug) {
      // Calculate coordinate transformation for this nested SVG
      const transform = window.BoundsCalculator.calculateNestedSVGTransform(nestedSvg, debug)

      if (debug) {
        console.log(`  Nested SVG transform: translateX=${transform.translateX}, translateY=${transform.translateY}, scaleX=${transform.scaleX}, scaleY=${transform.scaleY}`)
      }

      // Process all child elements within the nested SVG, including nested SVGs
      const childElements = nestedSvg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject, svg')

      childElements.forEach(childElement => {
        if (!window.VisibilityChecker.shouldIncludeElement(childElement, nestedSvg, debug)) return

        const tagName = childElement.tagName.toLowerCase()

        // Handle nested SVG elements recursively
        if (tagName === 'svg') {
          if (debug) {
            console.log('  Processing deeply nested SVG element')
          }
          // Recursively process the deeply nested SVG with accumulated transform
          processNestedSVGWithTransform(childElement, rootSvg, transform, debug)
          return
        }

        // Get bounds of the child element in its local coordinate system
        const localBounds = window.BoundsCalculator.getElementBounds(childElement, debug)

        if (localBounds.width === 0 && localBounds.height === 0) return

        // Apply nested SVG coordinate transformation
        const transformedBounds = window.BoundsCalculator.applyNestedSVGTransform(localBounds, transform, debug)

        updateGlobalBounds(transformedBounds)
        elementCount++

        // Analyze animations (calculate in local space, then transform)
        const animations = analyzeElementAnimations(childElement, nestedSvg, debug)
        if (animations.length > 0) {
          animationCount += animations.length

          // Calculate animated bounds in local coordinate space first
          if (typeof window.combineOverlappingAnimations === 'function') {
            const localAnimatedBounds = window.combineOverlappingAnimations(animations, localBounds, debug)
            // Then apply the nested SVG transform to the animated bounds
            const finalAnimatedBounds = window.BoundsCalculator.applyNestedSVGTransform(localAnimatedBounds, transform, debug)
            updateGlobalBounds(finalAnimatedBounds)
          } else {
            // Fallback: expand bounds using transformed bounds as base
            expandBoundsForAnimations(animations, transformedBounds, debug)
          }
        }

        // Analyze effects
        const effects = window.analyzeElementEffects ? window.analyzeElementEffects(childElement, nestedSvg, debug) : { hasAnyEffects: false }
        if (effects.hasAnyEffects) {
          effectsCount++
        }

        elements.push({
          type: tagName,
          bounds: transformedBounds,
          animations,
          hasEffects: effects.hasAnyEffects,
          nested: true
        })
      })
    }

    // Final bounds calculation
    const globalBounds = {
      x: isFinite(globalMinX) ? globalMinX : 0,
      y: isFinite(globalMinY) ? globalMinY : 0,
      width: isFinite(globalMaxX) && isFinite(globalMinX) ? globalMaxX - globalMinX : 0,
      height: isFinite(globalMaxY) && isFinite(globalMinY) ? globalMaxY - globalMinY : 0
    }

    if (debug) {
      console.log(`Found ${elementCount} elements, ${animationCount} animations, ${effectsCount} elements with effects`)
      console.log(`Global bounds: (${globalBounds.x.toFixed(2)}, ${globalBounds.y.toFixed(2)}) ${globalBounds.width.toFixed(2)}x${globalBounds.height.toFixed(2)}`)
    }

    return {
      originalViewBox,
      origWidth,
      origHeight,
      globalMinX: globalBounds.x,
      globalMinY: globalBounds.y,
      globalMaxX: globalBounds.x + globalBounds.width,
      globalMaxY: globalBounds.y + globalBounds.height,
      elementCount,
      animationCount,
      effectsCount,
      elements
    }
  }

  // Public API
  return {
    analyzeSVG
  }
})()

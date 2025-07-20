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

      // Handle container symbols by processing their child use elements
      if (isContainerSymbol(referencedSymbol)) {
        if (debug) {
          console.log(`  Processing container symbol ${href} - expanding children`)
        }

        // Get the cumulative transform matrix for the container use element
        const containerMatrix = window.calculateCumulativeTransform ? window.calculateCumulativeTransform(useEl, svg) : null

        // Process each child use element within the symbol
        const childUseElements = referencedSymbol.querySelectorAll('use')
        childUseElements.forEach(childUse => {
          const childHref = childUse.getAttribute('xlink:href') || childUse.getAttribute('href')
          if (!childHref || !childHref.startsWith('#')) return

          const childSymbol = svg.querySelector(childHref)
          if (!childSymbol) return

          const bounds = window.BoundsCalculator.getElementBounds(childSymbol, debug)
          if (bounds.width === 0 && bounds.height === 0) return

          // Apply container transform if available
          let finalBounds = bounds
          if (containerMatrix && containerMatrix.transformBounds) {
            finalBounds = containerMatrix.transformBounds(bounds)
          }

          updateGlobalBounds(finalBounds)
          elementCount++

          // Analyze animations on the container use element
          const animations = analyzeElementAnimations(useEl, svg, debug)
          if (animations.length > 0) {
            animationCount += animations.length
            // Process animation bounds would go here
          }

          elements.push({
            type: 'use',
            href: childHref,
            bounds: finalBounds,
            animations,
            hasEffects: false
          })
        })
      } else {
        // Process direct symbol reference
        const bounds = window.BoundsCalculator.getElementBounds(referencedSymbol, debug)
        if (bounds.width === 0 && bounds.height === 0) return

        updateGlobalBounds(bounds)
        elementCount++

        // Analyze animations
        const animations = analyzeElementAnimations(useEl, svg, debug)
        if (animations.length > 0) {
          animationCount += animations.length
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

    // Process direct visual elements
    const visualElements = svg.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text, image, g, foreignObject, svg')

    if (debug) {
      console.log(`Processing ${visualElements.length} visual elements`)
    }

    visualElements.forEach(element => {
      if (!window.VisibilityChecker.shouldIncludeElement(element, svg, debug)) return

      const tagName = element.tagName.toLowerCase()

      // Handle nested SVG elements specially
      if (tagName === 'svg') {
        if (debug) {
          console.log('  Processing nested SVG element')
        }
        processNestedSVG(element, svg, debug)
        return
      }

      const bounds = window.BoundsCalculator.getElementBounds(element, debug)

      // Skip elements with zero bounds unless they have animations
      const hasAnimations = element.querySelector('animateTransform, animate, animateMotion') !== null
      if (bounds.width === 0 && bounds.height === 0 && !hasAnimations) {
        if (debug) {
          console.log(`  Skipping ${tagName} with zero bounds and no animations`)
        }
        return
      }

      updateGlobalBounds(bounds)
      elementCount++

      // Analyze animations
      const animations = analyzeElementAnimations(element, svg, debug)
      if (animations.length > 0) {
        animationCount += animations.length
      }

      // Analyze effects
      const effects = window.analyzeEffects ? window.analyzeEffects(element, debug) : { hasAnyEffects: false }
      if (effects.hasAnyEffects) {
        effectsCount++
      }

      elements.push({
        type: tagName,
        bounds,
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

    function isContainerSymbol (symbolElement) {
      const nestedUseElements = symbolElement.querySelectorAll('use')
      return nestedUseElements.length > 0
    }

    function analyzeElementAnimations (element, svg, debug) {
      // Use the sophisticated animation analyzer that was injected
      if (typeof window.findElementAnimations === 'function') {
        return window.findElementAnimations(element, svg, debug)
      }

      // Fallback to simple animation detection
      const animations = []
      const animationElements = element.querySelectorAll('animateTransform, animate, animateMotion')
      animationElements.forEach(anim => {
        animations.push({
          type: anim.tagName.toLowerCase(),
          element: anim
        })
      })
      return animations
    }

    function processNestedSVG (nestedSvg, rootSvg, debug) {
      // This would handle nested SVG processing
      // For now, just get basic bounds
      const bounds = window.BoundsCalculator.getElementBounds(nestedSvg, debug)
      if (bounds.width > 0 && bounds.height > 0) {
        updateGlobalBounds(bounds)
        elementCount++
      }
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

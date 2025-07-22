/**
 * Browser-compatible visibility checking module
 *
 * Determines if SVG elements should be included in viewBox calculations
 * by checking visibility attributes, CSS styles, and parent inheritance.
 */

/* global getComputedStyle, SVGElement */

window.VisibilityChecker = (function () {
  'use strict'

  /**
   * Check if an element is visible and should be included in bounds calculations
   * @param {Element} element - The element to check
   * @param {Element} rootSvg - The root SVG element for context
   * @param {boolean} debug - Enable debug logging
   * @returns {boolean} True if element should be included
   */
  function shouldIncludeElement (element, rootSvg, debug = false) {
    // Skip elements inside defs, symbol definitions, or nested SVG elements
    let parent = element.parentElement
    while (parent && parent !== rootSvg) {
      const tagName = parent.tagName.toLowerCase()
      if (tagName === 'defs' || tagName === 'symbol' || tagName === 'svg') {
        return false
      }
      parent = parent.parentElement
    }

    // Check if element is visible
    if (!isElementVisible(element, rootSvg, debug)) {
      return false
    }

    return true
  }

  /**
   * Evaluate animated visibility states for an element
   * @param {Element} element - The element to check
   * @param {Element} rootSvg - The root SVG element for context
   * @param {boolean} debug - Enable debug logging
   * @returns {Object} Visibility state information
   */
  function evaluateAnimatedVisibility (element, rootSvg, debug = false) {
    // Find all visibility-related animations for this element
    const animations = []

    // Check direct child animations
    const childAnimations = element.querySelectorAll('set, animate')
    childAnimations.forEach(anim => {
      const attributeName = anim.getAttribute('attributeName')
      if (['opacity', 'display', 'visibility'].includes(attributeName)) {
        animations.push(parseVisibilityAnimation(anim))
      }
    })

    // Check animations targeting this element by id
    if (element.id) {
      const targetedAnimations = rootSvg.querySelectorAll(`set[href="#${element.id}"], animate[href="#${element.id}"]`)
      targetedAnimations.forEach(anim => {
        const attributeName = anim.getAttribute('attributeName')
        if (['opacity', 'display', 'visibility'].includes(attributeName)) {
          animations.push(parseVisibilityAnimation(anim))
        }
      })
    }

    // Filter out null animations (unsupported timing, etc.)
    const validAnimations = animations.filter(anim => anim !== null)

    if (validAnimations.length === 0) {
      return { hasAnimations: false, isVisible: null }
    }

    // For Phase 1: Conservative approach
    // If any animation could make the element visible at any point, include it
    // If all animations make it invisible from the start, exclude it
    let couldBeVisible = false
    let couldBeInvisible = false

    validAnimations.forEach(anim => {
      if (!anim || !anim.type) return // Skip null/invalid animations

      if (anim.type === 'set') {
        // For event-based set animations, be more conservative
        // Element might be visible before the event triggers
        if (anim.isEventBased) {
          // Conservative: assume element could be visible initially
          couldBeVisible = true
          // But also track that it could become invisible
          if ((anim.attributeName === 'opacity' && anim.to === '0') ||
              (anim.attributeName === 'display' && anim.to === 'none') ||
              (anim.attributeName === 'visibility' && anim.to === 'hidden')) {
            couldBeInvisible = true
          }
        } else {
          // Time-based animations: check if the set animation makes element visible or invisible
          if (anim.attributeName === 'opacity' && anim.to !== '0') {
            couldBeVisible = true
          } else if (anim.attributeName === 'display' && anim.to !== 'none') {
            couldBeVisible = true
          } else if (anim.attributeName === 'visibility' && anim.to !== 'hidden') {
            couldBeVisible = true
          } else {
            couldBeInvisible = true
          }
        }
      } else if (anim.type === 'animate' && anim.attributeName === 'opacity') {
        // For opacity animations, check if any value is non-zero
        const hasVisibleOpacity = anim.values && anim.values.some(v => parseFloat(v) > 0)
        if (hasVisibleOpacity) {
          couldBeVisible = true
        } else {
          couldBeInvisible = true
        }
      }
    })

    if (debug && validAnimations.length > 0) {
      console.log(`Element has ${validAnimations.length} visibility animations, couldBeVisible: ${couldBeVisible}, couldBeInvisible: ${couldBeInvisible}`)
    }

    // Conservative approach: if it could be visible at any point, include it
    return {
      hasAnimations: true,
      isVisible: couldBeVisible,
      animations: validAnimations
    }
  }

  /**
   * Parse a visibility-related animation element
   * @param {Element} animElement - The animation element (set or animate)
   * @returns {Object|null} Parsed animation data or null if unsupported
   */
  function parseVisibilityAnimation (animElement) {
    const tagName = animElement.tagName.toLowerCase()
    const attributeName = animElement.getAttribute('attributeName')
    const begin = animElement.getAttribute('begin') || '0s'

    // Phase 2/3: Handle definite timing, event-based timing, and syncbase timing
    const beginStr = String(begin)
    const timeMatch = beginStr.match(/^(\d+(?:\.\d+)?)(s|ms)?$/)
    const eventMatch = beginStr.match(/^(click|mouseover|mouseout|mouseenter|mouseleave|focus|blur)(\+(\d+(?:\.\d+)?)(s|ms)?)?$/)
    const syncbaseMatch = beginStr.match(/^([a-zA-Z][\w-]*)\.(begin|end)(?:\+(\d+(?:\.\d+)?)(s|ms)?)?$/)

    if (!timeMatch && !eventMatch && !syncbaseMatch && beginStr !== '0s' && beginStr !== '0') {
      return null // Skip other complex timing (indefinite, etc.)
    }

    const isEventBased = !!(eventMatch || syncbaseMatch)

    if (tagName === 'set') {
      const to = animElement.getAttribute('to')
      return {
        type: 'set',
        attributeName,
        to,
        begin,
        isEventBased
      }
    } else if (tagName === 'animate' && attributeName === 'opacity') {
      const values = animElement.getAttribute('values')
      const from = animElement.getAttribute('from')
      const to = animElement.getAttribute('to')

      let parsedValues = []
      if (values) {
        parsedValues = values.split(';').map(v => v.trim())
      } else if (from && to) {
        parsedValues = [from, to]
      }

      return {
        type: 'animate',
        attributeName,
        values: parsedValues,
        begin,
        isEventBased
      }
    }

    return null
  }

  /**
   * Check if an element is visible (not hidden by display, visibility, or opacity)
   * @param {Element} element - The element to check
   * @param {Element} rootSvg - The root SVG element for parent context
   * @param {boolean} debug - Enable debug logging
   * @returns {boolean} True if element is visible
   */
  function isElementVisible (element, rootSvg, debug = false) {
    // Check for animated visibility first
    const animatedVisibility = evaluateAnimatedVisibility(element, rootSvg, debug)
    if (animatedVisibility.hasAnimations) {
      // If element has visibility animations, use the animated visibility result
      if (debug && !animatedVisibility.isVisible) {
        console.log('Element hidden by animations:', element)
      }
      return animatedVisibility.isVisible
    }

    // No animations, check static visibility
    // First check element attributes (fastest check)
    if (element.getAttribute('display') === 'none' ||
        element.getAttribute('visibility') === 'hidden') {
      if (debug) {
        console.log('Element hidden by attributes:', element)
      }
      return false
    }

    // Check opacity attribute
    const opacityAttr = element.getAttribute('opacity')
    if (opacityAttr === '0' || opacityAttr === '0.0') {
      if (debug) {
        console.log('Element hidden by opacity attribute:', element)
      }
      return false
    }

    // Use getComputedStyle for comprehensive style checking
    try {
      const computed = getComputedStyle(element)

      // Check computed display
      if (computed.display === 'none') {
        if (debug) {
          console.log('Element hidden by computed display:', element)
        }
        return false
      }

      // Check computed visibility
      if (computed.visibility === 'hidden') {
        if (debug) {
          console.log('Element hidden by computed visibility:', element)
        }
        return false
      }

      // Check computed opacity
      const opacity = parseFloat(computed.opacity)
      if (opacity === 0) {
        if (debug) {
          console.log('Element hidden by computed opacity:', element)
        }
        return false
      }

      // Additional check: offsetParent for display:none detection
      // Note: offsetParent is null for SVG elements, fixed positioned elements
      // Only use this check for HTML elements
      const isSVGElement = element instanceof SVGElement || element.namespaceURI === 'http://www.w3.org/2000/svg'

      if (!isSVGElement && !element.offsetParent && computed.position !== 'fixed') {
        if (debug) {
          console.log('Element hidden by offsetParent check:', element)
        }
        return false
      }
    } catch (e) {
      // If getComputedStyle fails, fall back to attribute/inline style checks
      if (debug) {
        console.log('getComputedStyle failed for element:', e)
      }

      // Check inline styles as fallback
      if (element.style.display === 'none' ||
          element.style.visibility === 'hidden' ||
          element.style.opacity === '0') {
        if (debug) {
          console.log('Element hidden by inline styles:', element)
        }
        return false
      }
    }

    // Check if any parent is hidden (inheritance for display and visibility)
    let parent = element.parentElement
    while (parent && parent !== rootSvg) {
      // Check parent attributes
      if (parent.getAttribute('display') === 'none' ||
          parent.getAttribute('visibility') === 'hidden') {
        if (debug) {
          console.log('Element hidden by parent attributes:', element, 'parent:', parent)
        }
        return false
      }

      // Check parent opacity (0 opacity hides children)
      const parentOpacity = parent.getAttribute('opacity')
      if (parentOpacity === '0' || parentOpacity === '0.0') {
        if (debug) {
          console.log('Element hidden by parent opacity:', element, 'parent:', parent)
        }
        return false
      }

      // Check parent computed styles
      try {
        const parentComputed = getComputedStyle(parent)
        if (parentComputed.display === 'none' ||
            parentComputed.visibility === 'hidden' ||
            parseFloat(parentComputed.opacity) === 0) {
          if (debug) {
            console.log('Element hidden by parent computed styles:', element, 'parent:', parent)
          }
          return false
        }
      } catch (e) {
        // Fallback to inline styles
        if (parent.style.display === 'none' ||
            parent.style.visibility === 'hidden' ||
            parent.style.opacity === '0') {
          if (debug) {
            console.log('Element hidden by parent inline styles:', element, 'parent:', parent)
          }
          return false
        }
      }

      parent = parent.parentElement
    }

    return true
  }

  // Public API
  return {
    shouldIncludeElement,
    isElementVisible,
    evaluateAnimatedVisibility,
    parseVisibilityAnimation
  }
})()

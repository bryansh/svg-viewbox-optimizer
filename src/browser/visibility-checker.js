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
   * Check if an element is visible (not hidden by display, visibility, or opacity)
   * @param {Element} element - The element to check
   * @param {Element} rootSvg - The root SVG element for parent context
   * @param {boolean} debug - Enable debug logging
   * @returns {boolean} True if element is visible
   */
  function isElementVisible (element, rootSvg, debug = false) {
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
    isElementVisible
  }
})()

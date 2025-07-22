/**
 * Browser-compatible SVG switch element evaluator
 *
 * Handles conditional rendering evaluation for <switch> elements
 * based on requiredFeatures, requiredExtensions, and systemLanguage.
 */

/* global navigator */

window.SwitchEvaluator = (function () {
  'use strict'

  // SVG features that modern browsers typically support
  const SUPPORTED_SVG_FEATURES = [
    // Core SVG 1.1 features
    'http://www.w3.org/TR/SVG11/feature#SVG',
    'http://www.w3.org/TR/SVG11/feature#SVGDOM',
    'http://www.w3.org/TR/SVG11/feature#SVG-static',
    'http://www.w3.org/TR/SVG11/feature#SVG-animation',
    'http://www.w3.org/TR/SVG11/feature#SVG-dynamic',
    'http://www.w3.org/TR/SVG11/feature#SVGDOM-animation',
    'http://www.w3.org/TR/SVG11/feature#SVGDOM-dynamic',

    // Basic shapes and path
    'http://www.w3.org/TR/SVG11/feature#BasicStructure',
    'http://www.w3.org/TR/SVG11/feature#Shape',
    'http://www.w3.org/TR/SVG11/feature#Path',
    'http://www.w3.org/TR/SVG11/feature#BasicText',
    'http://www.w3.org/TR/SVG11/feature#PaintAttribute',
    'http://www.w3.org/TR/SVG11/feature#BasicPaintAttribute',
    'http://www.w3.org/TR/SVG11/feature#OpacityAttribute',

    // Gradients and patterns
    'http://www.w3.org/TR/SVG11/feature#Gradient',
    'http://www.w3.org/TR/SVG11/feature#Pattern',

    // Clipping, masking and effects
    'http://www.w3.org/TR/SVG11/feature#Clip',
    'http://www.w3.org/TR/SVG11/feature#Mask',
    'http://www.w3.org/TR/SVG11/feature#Filter',
    'http://www.w3.org/TR/SVG11/feature#BasicFilter',

    // Images and foreign objects
    'http://www.w3.org/TR/SVG11/feature#Image',
    'http://www.w3.org/TR/SVG11/feature#Extensibility',

    // Interaction
    'http://www.w3.org/TR/SVG11/feature#GraphicsAttribute',
    'http://www.w3.org/TR/SVG11/feature#XlinkAttribute',
    'http://www.w3.org/TR/SVG11/feature#ExternalResourcesRequired',

    // Styling
    'http://www.w3.org/TR/SVG11/feature#Style',
    'http://www.w3.org/TR/SVG11/feature#ViewportAttribute',

    // Modern/common features
    'org.w3c.svg.static', // Alternative shorter form
    'org.w3c.svg.animation',
    'org.w3c.svg.dynamic',
    'org.w3c.dom.svg',
    'org.w3c.dom.svg.static'
  ]

  /**
   * Check if a required feature is supported by the current browser
   * @param {string} feature - The feature URI to check
   * @returns {boolean} True if the feature is supported
   */
  function isFeatureSupported (feature) {
    // Normalize the feature string
    const normalizedFeature = feature.trim()

    // Check against our supported features list first
    if (SUPPORTED_SVG_FEATURES.includes(normalizedFeature)) {
      return true
    }

    // Don't trust browser hasFeature for unknown/custom URIs
    // Many browsers return true for any URI that looks valid
    // Only use native hasFeature for well-known W3C SVG features
    const isW3cSvgFeature = normalizedFeature.startsWith('http://www.w3.org/TR/SVG') || 
                           normalizedFeature.startsWith('org.w3c.svg') ||
                           normalizedFeature.startsWith('org.w3c.dom.svg')

    if (isW3cSvgFeature) {
      // Try browser's native implementation for W3C features
      if (typeof SVGElement !== 'undefined' && SVGElement.prototype.hasFeature) {
        try {
          return SVGElement.prototype.hasFeature(normalizedFeature, '1.1')
        } catch (e) {
          // Ignore errors and fall through
        }
      }

      // Try document implementation
      if (document.implementation && document.implementation.hasFeature) {
        try {
          return document.implementation.hasFeature(normalizedFeature, '1.1')
        } catch (e) {
          // Ignore errors and fall through
        }
      }
    }

    // Conservative fallback: unknown features are not supported
    return false
  }

  /**
   * Check if a system language requirement is met
   * @param {string} systemLanguage - Comma-separated list of language codes
   * @returns {boolean} True if any of the languages match
   */
  function isSystemLanguageSupported (systemLanguage) {
    if (!systemLanguage || !navigator.language) {
      return false
    }

    const requiredLanguages = systemLanguage.split(',').map(lang => lang.trim().toLowerCase())
    const userLanguage = navigator.language.toLowerCase()
    const userLanguageShort = userLanguage.split('-')[0] // e.g., 'en' from 'en-US'

    return requiredLanguages.some(lang => {
      const langNormalized = lang.toLowerCase()
      return userLanguage === langNormalized || 
             userLanguageShort === langNormalized ||
             userLanguage.startsWith(langNormalized + '-')
    })
  }

  /**
   * Evaluate conditional attributes for an element
   * @param {Element} element - The element to evaluate
   * @returns {boolean} True if the element should be rendered
   */
  function shouldRenderElement (element) {
    // Check requiredFeatures
    const requiredFeatures = element.getAttribute('requiredFeatures')
    if (requiredFeatures) {
      const features = requiredFeatures.split(/[\s,]+/).filter(f => f.trim())
      const allSupported = features.every(feature => isFeatureSupported(feature))
      if (!allSupported) {
        return false
      }
    }

    // Check requiredExtensions
    const requiredExtensions = element.getAttribute('requiredExtensions')
    if (requiredExtensions) {
      // Extensions are typically not supported in standard browsers
      // Conservative approach: if extensions are required, don't render
      return false
    }

    // Check systemLanguage
    const systemLanguage = element.getAttribute('systemLanguage')
    if (systemLanguage) {
      if (!isSystemLanguageSupported(systemLanguage)) {
        return false
      }
    }

    // If all conditions pass (or none are specified), render the element
    return true
  }

  /**
   * Evaluate a <switch> element and return the first child that should be rendered
   * @param {Element} switchElement - The <switch> element to evaluate
   * @param {boolean} debug - Enable debug logging
   * @returns {Element|null} The first child element that should be rendered, or null
   */
  function evaluateSwitch (switchElement, debug = false) {
    if (switchElement.tagName.toLowerCase() !== 'switch') {
      return null
    }

    const children = Array.from(switchElement.children)
    
    if (debug) {
      console.log(`Evaluating switch element with ${children.length} children`)
    }

    for (const child of children) {
      if (shouldRenderElement(child)) {
        if (debug) {
          console.log(`  Selected child: ${child.tagName} (passed conditional tests)`)
        }
        return child
      } else if (debug) {
        const requiredFeatures = child.getAttribute('requiredFeatures')
        const requiredExtensions = child.getAttribute('requiredExtensions')
        const systemLanguage = child.getAttribute('systemLanguage')
        console.log(`  Skipped child: ${child.tagName} (failed: requiredFeatures="${requiredFeatures}", requiredExtensions="${requiredExtensions}", systemLanguage="${systemLanguage}")`)
      }
    }

    if (debug) {
      console.log('  No suitable child found in switch element')
    }

    return null // No child meets the requirements
  }

  /**
   * Get all elements that should be rendered from switch elements
   * @param {Element} rootSvg - The root SVG element
   * @param {boolean} debug - Enable debug logging
   * @returns {Element[]} Array of elements that should be rendered
   */
  function getActiveElementsFromSwitches (rootSvg, debug = false) {
    const switchElements = rootSvg.querySelectorAll('switch')
    const activeElements = []

    switchElements.forEach(switchElement => {
      const activeChild = evaluateSwitch(switchElement, debug)
      if (activeChild) {
        activeElements.push(activeChild)
      }
    })

    if (debug && switchElements.length > 0) {
      console.log(`Processed ${switchElements.length} switch elements, ${activeElements.length} active children selected`)
    }

    return activeElements
  }

  /**
   * Check if an element should be included based on conditional attributes
   * (for non-switch elements that may have requiredFeatures etc.)
   * @param {Element} element - The element to check
   * @param {boolean} debug - Enable debug logging
   * @returns {boolean} True if the element should be included
   */
  function shouldIncludeElement (element, debug = false) {
    // Skip if element is inside a switch (let switch evaluation handle it)
    let parent = element.parentElement
    while (parent) {
      if (parent.tagName && parent.tagName.toLowerCase() === 'switch') {
        return false // Will be handled by switch evaluation
      }
      parent = parent.parentElement
    }

    // Check conditional attributes on the element itself
    const shouldRender = shouldRenderElement(element)
    
    if (debug && !shouldRender) {
      console.log(`Element ${element.tagName} excluded due to conditional attributes`)
    }

    return shouldRender
  }

  // Public API
  return {
    evaluateSwitch,
    getActiveElementsFromSwitches,
    shouldIncludeElement,
    isFeatureSupported,
    isSystemLanguageSupported
  }
})()
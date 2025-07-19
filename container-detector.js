/**
 * SVG Container Detector
 * Detects container elements vs content elements to avoid double-counting
 */

/**
 * Check if an element is a definition container (defs, symbol)
 */
function isDefinitionContainer (element) {
  const tagName = element.tagName.toLowerCase()
  return tagName === 'defs' || tagName === 'symbol'
}

/**
 * Check if an element is inside a definition container
 */
function isInsideDefinition (element, rootSvg) {
  let parent = element.parentElement
  while (parent && parent !== rootSvg) {
    if (isDefinitionContainer(parent)) {
      return true
    }
    parent = parent.parentElement
  }
  return false
}

/**
 * Check if a symbol element contains nested use elements (making it a container)
 */
function isContainerSymbol (symbolElement) {
  const nestedUseElements = symbolElement.querySelectorAll('use')
  return nestedUseElements.length > 0
}

/**
 * Check if a use element references a container symbol
 */
function referencesContainer (useElement, rootSvg) {
  const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href')

  if (!href || !href.startsWith('#')) {
    return false
  }

  const referencedElement = rootSvg.querySelector(href)
  if (!referencedElement) {
    return false
  }

  // If it's a symbol with nested use elements, it's a container
  if (referencedElement.tagName.toLowerCase() === 'symbol') {
    return isContainerSymbol(referencedElement)
  }

  return false
}

/**
 * Check if a group element is purely organizational (container)
 */
function isContainerGroup (groupElement) {
  // A group is considered a container if it only contains other grouping elements
  // and doesn't have its own visual properties or transforms that affect rendering
  const children = Array.from(groupElement.children)

  if (children.length === 0) {
    return true // Empty group is a container
  }

  // Check if all children are grouping elements
  const groupingTags = ['g', 'defs', 'symbol', 'use', 'clippath', 'mask', 'pattern', 'marker']
  const allChildrenAreGroups = children.every(child =>
    groupingTags.includes(child.tagName.toLowerCase())
  )

  // If it has visual attributes or transforms, it might be contributing to the rendering
  const hasVisualAttributes = groupElement.hasAttribute('fill') ||
                              groupElement.hasAttribute('stroke') ||
                              groupElement.hasAttribute('opacity') ||
                              groupElement.hasAttribute('filter')

  const hasTransform = groupElement.hasAttribute('transform')

  // It's a container if all children are groups and it has no visual impact
  return allChildrenAreGroups && !hasVisualAttributes && !hasTransform
}

/**
 * Determine if an element should be processed for bounds calculation
 */
function shouldProcessElement (element, rootSvg, debug = false) {
  const tagName = element.tagName.toLowerCase()
  const elementId = element.id || `<${tagName}>`

  if (debug) {
    console.log(`  Checking ${elementId}`)
  }

  // Skip elements inside definition containers
  if (isInsideDefinition(element, rootSvg)) {
    if (debug) {
      console.log('    Skipping: inside definition container')
    }
    return false
  }

  // Skip use elements that reference container symbols
  if (tagName === 'use' && referencesContainer(element, rootSvg)) {
    if (debug) {
      console.log('    Skipping: references container symbol')
    }
    return false
  }

  // Skip container groups
  if (tagName === 'g' && isContainerGroup(element)) {
    if (debug) {
      console.log('    Skipping: container group')
    }
    return false
  }

  // Skip definition containers themselves
  if (isDefinitionContainer(element)) {
    if (debug) {
      console.log('    Skipping: definition container')
    }
    return false
  }

  if (debug) {
    console.log('    Including: content element')
  }
  return true
}

/**
 * Find all content elements (elements that contribute to visual bounds)
 */
function findContentElements (rootSvg, debug = false) {
  if (debug) {
    console.log('\n=== Finding Content Elements ===')
  }

  const contentElements = []

  // Find all potentially relevant elements
  const allElements = rootSvg.querySelectorAll('*')

  if (debug) {
    console.log(`Checking ${allElements.length} total elements`)
  }

  allElements.forEach(element => {
    if (shouldProcessElement(element, rootSvg, debug)) {
      contentElements.push(element)
    }
  })

  if (debug) {
    console.log(`Found ${contentElements.length} content elements to process`)
  }

  return contentElements
}

/**
 * Analyze the SVG structure and return processing recommendations
 */
function analyzeStructure (rootSvg, debug = false) {
  const analysis = {
    totalElements: rootSvg.querySelectorAll('*').length,
    useElements: rootSvg.querySelectorAll('use').length,
    symbolElements: rootSvg.querySelectorAll('symbol').length,
    groupElements: rootSvg.querySelectorAll('g').length,
    definitionElements: rootSvg.querySelectorAll('defs').length,
    containerSymbols: 0,
    containerGroups: 0,
    contentElements: 0
  }

  // Count container symbols
  const symbols = rootSvg.querySelectorAll('symbol')
  symbols.forEach(symbol => {
    if (isContainerSymbol(symbol)) {
      analysis.containerSymbols++
    }
  })

  // Count container groups
  const groups = rootSvg.querySelectorAll('g')
  groups.forEach(group => {
    if (isContainerGroup(group)) {
      analysis.containerGroups++
    }
  })

  // Count content elements
  analysis.contentElements = findContentElements(rootSvg, false).length

  if (debug) {
    console.log('\n=== SVG Structure Analysis ===')
    console.log(`Total elements: ${analysis.totalElements}`)
    console.log(`Use elements: ${analysis.useElements}`)
    console.log(`Symbol elements: ${analysis.symbolElements} (${analysis.containerSymbols} containers)`)
    console.log(`Group elements: ${analysis.groupElements} (${analysis.containerGroups} containers)`)
    console.log(`Definition elements: ${analysis.definitionElements}`)
    console.log(`Content elements to process: ${analysis.contentElements}`)
  }

  return analysis
}

module.exports = {
  isDefinitionContainer,
  isInsideDefinition,
  isContainerSymbol,
  referencesContainer,
  isContainerGroup,
  shouldProcessElement,
  findContentElements,
  analyzeStructure
}

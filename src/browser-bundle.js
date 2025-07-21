const fs = require('fs').promises
const path = require('path')

/**
 * Browser Bundle Builder
 *
 * Handles loading and preparing all browser modules for injection into Puppeteer context.
 * Eliminates synchronous file reading and messy string manipulation from the main calculator.
 */
class BrowserBundle {
  constructor () {
    this.moduleCache = new Map()
  }

  /**
   * Build complete browser bundle with all modules
   * @returns {Promise<string>} Complete HTML with all browser modules
   */
  async buildHTML (svgContent) {
    const modules = await this.loadAllModules()

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          ${modules.join('\n\n')}
        </script>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `
  }

  /**
   * Load all browser modules in parallel
   * @returns {Promise<string[]>} Array of browser-ready module code
   */
  async loadAllModules () {
    const modulePromises = [
      // New clean browser modules (no processing needed)
      this.loadBrowserModule('visibility-checker.js'),
      this.loadBrowserModule('bounds-calculator.js'),
      this.loadBrowserModule('svg-analyzer.js'),

      // Legacy Node.js modules (need processing)
      this.loadAndProcessNodeModule('animation-analyzer.js'),
      this.loadAndProcessNodeModule('svg-path-parser.js'),
      this.loadAndProcessNodeModule('animation-combiner.js'),
      this.loadAndProcessNodeModule('effects-analyzer.js'),
      this.loadAndProcessNodeModule('transform-parser.js')
    ]

    return Promise.all(modulePromises)
  }

  /**
   * Load a clean browser module (no processing needed)
   * @param {string} filename - Module filename in src/browser/
   * @returns {Promise<string>} Module code ready for browser
   */
  async loadBrowserModule (filename) {
    const cacheKey = `browser:${filename}`

    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey)
    }

    const modulePath = path.join(__dirname, 'browser', filename)
    const moduleCode = await fs.readFile(modulePath, 'utf8')

    // Add a comment header for debugging
    const processedCode = `// === ${filename} ===\n${moduleCode}`

    this.moduleCache.set(cacheKey, processedCode)
    return processedCode
  }

  /**
   * Load and process a Node.js module for browser compatibility
   * @param {string} filename - Module filename in src/lib/
   * @returns {Promise<string>} Processed module code ready for browser
   */
  async loadAndProcessNodeModule (filename) {
    const cacheKey = `node:${filename}`

    if (this.moduleCache.has(cacheKey)) {
      return this.moduleCache.get(cacheKey)
    }

    const modulePath = path.join(__dirname, 'lib', filename)
    const moduleCode = await fs.readFile(modulePath, 'utf8')

    // Process Node.js module for browser compatibility
    const processedCode = this.processNodeModuleForBrowser(moduleCode, filename)

    this.moduleCache.set(cacheKey, processedCode)
    return processedCode
  }

  /**
   * Process Node.js module code to make it browser compatible
   * @param {string} code - Original Node.js module code
   * @param {string} filename - Filename for debugging
   * @returns {string} Browser-compatible code
   */
  processNodeModuleForBrowser (code, filename) {
    let processedCode = code

    // Remove Node.js require statements
    processedCode = processedCode.replace(/const \{ Matrix2D \} = require\('.*'\)/g, '')
    processedCode = processedCode.replace(/const \{ calculatePathBounds, calculateMotionValuesBounds \} = require\('.*'\)/g, '')

    // Replace module.exports with window assignments for browser compatibility
    processedCode = processedCode.replace(/module\.exports = \{([^}]*)\}/g, (match, exports) => {
      // Extract function names from exports
      const functionNames = exports.split(',').map(name => name.trim()).filter(name => name)

      // Create window assignments - group by module
      if (filename === 'transform-parser.js') {
        // Create TransformParser namespace for transform-parser exports
        const windowAssignments = functionNames.map(name => `window.TransformParser.${name} = ${name}`).join('\n')
        return `window.TransformParser = window.TransformParser || {};\n${windowAssignments}`
      } else {
        // Standard window assignments for other modules
        const windowAssignments = functionNames.map(name => `window.${name} = ${name}`).join('\n')
        return windowAssignments
      }
    })

    // Add comment header for debugging
    processedCode = `// === ${filename} (processed) ===\n${processedCode}`

    return processedCode
  }

  /**
   * Clear module cache (useful for testing)
   */
  clearCache () {
    this.moduleCache.clear()
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats () {
    return {
      size: this.moduleCache.size,
      keys: Array.from(this.moduleCache.keys())
    }
  }
}

module.exports = { BrowserBundle }

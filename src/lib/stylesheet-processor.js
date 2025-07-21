const fs = require('fs').promises
const path = require('path')

/**
 * Processes SVG content to inline external stylesheets
 * 
 * Finds <link> elements that reference external CSS files and replaces
 * them with <style> blocks containing the CSS content.
 */
class StylesheetProcessor {
  constructor (basePath) {
    this.basePath = basePath || process.cwd()
  }

  /**
   * Process SVG content and inline all external stylesheets
   * @param {string} svgContent - The SVG content as a string
   * @returns {Promise<string>} SVG content with inlined styles
   */
  async processStylesheets (svgContent) {
    // Find all <link> elements that reference stylesheets
    const linkPattern = /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*>/gi
    const links = []
    let match

    // Collect all stylesheet links
    while ((match = linkPattern.exec(svgContent)) !== null) {
      links.push({
        fullMatch: match[0],
        href: match[1]
      })
    }

    if (links.length === 0) {
      return svgContent // No external stylesheets to process
    }

    // Process each link
    let processedContent = svgContent
    for (const link of links) {
      try {
        // Resolve the CSS file path relative to the SVG file
        const cssPath = path.resolve(this.basePath, link.href)
        
        // Read the CSS content
        const cssContent = await fs.readFile(cssPath, 'utf8')
        
        // Create a style block with the CSS content
        const styleBlock = `<style type="text/css">\n/* Inlined from ${link.href} */\n${cssContent}\n</style>`
        
        // Replace the link element with the style block
        processedContent = processedContent.replace(link.fullMatch, styleBlock)
        
        console.log(`Inlined stylesheet: ${link.href}`)
      } catch (error) {
        console.warn(`Warning: Could not load stylesheet ${link.href}:`, error.message)
        // Continue processing other stylesheets
      }
    }

    // Also handle @import statements within <style> blocks
    processedContent = await this.processImports(processedContent)

    return processedContent
  }

  /**
   * Process @import statements within style blocks
   * @param {string} content - The SVG content
   * @returns {Promise<string>} Content with @imports resolved
   */
  async processImports (content) {
    // Find all @import statements
    const importPattern = /@import\s+(?:url\s*\(\s*)?["']([^"']+\.css)["']\s*\)?[^;]*;/gi
    const imports = []
    let match

    while ((match = importPattern.exec(content)) !== null) {
      imports.push({
        fullMatch: match[0],
        href: match[1]
      })
    }

    if (imports.length === 0) {
      return content
    }

    // Process each import
    let processedContent = content
    for (const imp of imports) {
      try {
        const cssPath = path.resolve(this.basePath, imp.href)
        const cssContent = await fs.readFile(cssPath, 'utf8')
        
        // Replace the @import with the actual CSS content
        processedContent = processedContent.replace(
          imp.fullMatch,
          `/* Inlined from @import ${imp.href} */\n${cssContent}`
        )
        
        console.log(`Inlined @import: ${imp.href}`)
      } catch (error) {
        console.warn(`Warning: Could not load @import ${imp.href}:`, error.message)
      }
    }

    // Recursively process any @imports in the newly inlined content
    if (processedContent !== content) {
      return this.processImports(processedContent)
    }

    return processedContent
  }
}

module.exports = { StylesheetProcessor }
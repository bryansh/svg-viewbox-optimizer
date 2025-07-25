const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')
// Transform parser - not directly used in main calculator but available to browser modules
const { BrowserBundle } = require('./src/browser-bundle')
const { StylesheetProcessor } = require('./src/lib/stylesheet-processor')

async function instantiateBrowser () {
  let browser

  // Launch headless browser
  try {
    browser = await puppeteer.launch({ headless: 'new' })
  } catch (error) {
    // Fallback for restricted environments (Docker, CI/CD, etc.)
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
  }

  return browser
}

async function calculateOptimization (inputFile, options = {}) {
  const fontTimeout = options.fontTimeout || 5000 // Default 5 second font loading timeout
  const failOnFontTimeout = options.failOnFontTimeout !== false // Default to true (fail on timeout)
  const scriptDelay = options.scriptDelay || 0 // Default 0ms - no additional wait for script-generated content
  const browser = await instantiateBrowser()

  try {
    let svgContent = fs.readFileSync(inputFile, 'utf8')
    const buffer = options.buffer !== undefined ? parseInt(options.buffer) : 10

    // Process external stylesheets
    const stylesheetProcessor = new StylesheetProcessor(path.dirname(inputFile))
    svgContent = await stylesheetProcessor.processStylesheets(svgContent)

    const page = await browser.newPage()

    // Capture console output
    if (options.debug) {
      page.on('console', msg => console.log('Browser console:', msg.text()))
    }

    // Use browser bundle builder to create clean HTML with all modules
    const browserBundle = new BrowserBundle()
    const html = await browserBundle.buildHTML(svgContent)

    await page.setContent(html, {
      waitUntil: 'networkidle0', // Wait for network requests to finish
      timeout: 10000 // 10 second timeout for content loading
    })

    // Wait for script-generated content if configured
    if (scriptDelay > 0) {
      if (options.debug) {
        console.log(`Waiting ${scriptDelay}ms for script-generated content...`)
      }
      await page.evaluate((delay) => {
        return new Promise(resolve => setTimeout(resolve, delay))
      }, scriptDelay)
    }

    // Calculate bounds using the new modular architecture
    const bounds = await page.evaluate(async (debugMode, fontTimeoutMs, failOnTimeout) => {
      const debug = debugMode

      // Wait for fonts to load before calculating bounds
      try {
        if (document.fonts && document.fonts.ready) {
          if (debug) {
            console.log('Waiting for fonts to load...')
          }

          // Add a timeout to prevent hanging on slow font loads
          const fontLoadPromise = document.fonts.ready
          const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
              if (failOnTimeout) {
                reject(new Error(`Font loading timeout: Web fonts took longer than ${fontTimeoutMs / 1000} seconds to load. This could result in inaccurate text bounds.`))
              } else {
                if (debug) {
                  console.log('Font loading timeout reached, proceeding with fallback fonts')
                }
                resolve()
              }
            }, fontTimeoutMs)
          })

          await Promise.race([fontLoadPromise, timeoutPromise])
          if (debug) {
            console.log('Fonts loaded successfully')
          }
        } else if (debug) {
          console.log('Font loading API not available, proceeding without font synchronization')
        }
      } catch (fontError) {
        if (debug) {
          console.log('Font loading failed, proceeding with fallback fonts:', fontError.message)
        }
        // Continue with analysis even if font loading fails
      }

      // Use the modular SVG analyzer
      if (typeof window.SVGAnalyzer === 'undefined') {
        throw new Error('Modular SVG analyzer not loaded')
      }

      const result = window.SVGAnalyzer.analyzeSVG(debug)
      if (result.error) {
        return result
      }

      // Convert to the expected format
      return {
        originalViewBox: result.originalViewBox,
        origWidth: result.origWidth,
        origHeight: result.origHeight,
        globalMinX: result.globalMinX,
        globalMinY: result.globalMinY,
        globalMaxX: result.globalMaxX,
        globalMaxY: result.globalMaxY,
        elementCount: result.elementCount,
        animationCount: result.animationCount,
        effectsCount: result.effectsCount,
        elements: result.elements
      }
    }, options.debug, fontTimeout, failOnFontTimeout)

    await browser.close()

    // Check for errors
    if (bounds.error) {
      throw new Error(bounds.error)
    }

    // Calculate new viewBox
    const newX = bounds.globalMinX - buffer
    const newY = bounds.globalMinY - buffer
    const newWidth = (bounds.globalMaxX - bounds.globalMinX) + (buffer * 2)
    const newHeight = (bounds.globalMaxY - bounds.globalMinY) + (buffer * 2)

    // Parse original viewBox for compatibility
    const [, , origWidth, origHeight] = bounds.originalViewBox.split(' ').map(Number)
    const originalArea = origWidth * origHeight
    const newArea = newWidth * newHeight
    const spaceSavings = originalArea > 0 ? ((originalArea - newArea) / originalArea) * 100 : 0

    return {
      // Legacy format for CLI compatibility
      original: {
        viewBox: bounds.originalViewBox,
        width: origWidth,
        height: origHeight,
        area: originalArea
      },
      // CLI format
      optimized: {
        viewBox: `${newX.toFixed(2)} ${newY.toFixed(2)} ${newWidth.toFixed(2)} ${newHeight.toFixed(2)}`,
        width: newWidth,
        height: newHeight,
        area: newArea
      },
      buffer,
      newViewBox: { x: newX, y: newY, width: newWidth, height: newHeight },
      // Legacy test format
      content: {
        minX: bounds.globalMinX,
        minY: bounds.globalMinY,
        maxX: bounds.globalMaxX,
        maxY: bounds.globalMaxY,
        width: bounds.globalMaxX - bounds.globalMinX,
        height: bounds.globalMaxY - bounds.globalMinY
      },
      // New format
      contentBounds: {
        x: bounds.globalMinX,
        y: bounds.globalMinY,
        width: bounds.globalMaxX - bounds.globalMinX,
        height: bounds.globalMaxY - bounds.globalMinY
      },
      savings: {
        percentage: spaceSavings,
        unitsSquared: originalArea - newArea
      },
      spaceSavings,
      elements: {
        count: bounds.elementCount,
        animationCount: bounds.animationCount,
        effectsCount: bounds.effectsCount,
        details: bounds.elements.map(el => ({
          id: el.type || 'unknown',
          animations: el.animations ? el.animations.length : 0,
          hasAnimations: el.animations && el.animations.length > 0,
          hasEffects: el.hasEffects || false
        }))
      }
    }
  } catch (error) {
    await browser.close()
    throw error
  }
}

module.exports = { calculateOptimization }

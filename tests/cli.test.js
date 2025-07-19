const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { calculateOptimization } = require('../viewbox-calculator')

describe('CLI Interface', () => {
  const cli = path.join(__dirname, '..', 'index.js')
  const fixturesDir = path.join(__dirname, 'fixtures')
  const tempDir = os.tmpdir()

  describe('Basic functionality', () => {
    it('should show help when no arguments provided', () => {
      const result = execSync(`node ${cli} --help`, { encoding: 'utf8' })
      expect(result).toContain('Optimize SVG viewBox')
      expect(result).toContain('Usage:')
      expect(result).toContain('Options:')
    })

    it('should show version', () => {
      const packageJson = require('../package.json')
      const result = execSync(`node ${cli} --version`, { encoding: 'utf8' })
      expect(result.trim()).toBe(packageJson.version)
    })

    it('should error on non-existent file', () => {
      expect(() => {
        execSync(`node ${cli} non-existent.svg`, { stdio: 'pipe' })
      }).toThrow()
    })
  })

  describe('File processing', () => {
    it('should process simple SVG with dry-run', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = execSync(`node ${cli} ${input} --dry-run`, { encoding: 'utf8' })

      expect(result).toContain('Analyzing SVG...')
      expect(result).toContain('Original viewBox: 0 0 200 200')
      expect(result).toContain('New viewBox:')
      expect(result).toContain('Space savings:')
      expect(result).not.toContain('Optimized SVG saved')
    })

    it('should create output file', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const output = path.join(tempDir, 'test-output.svg')

      // Clean up any existing file
      if (fs.existsSync(output)) {
        fs.unlinkSync(output)
      }

      execSync(`node ${cli} ${input} -o ${output}`, { encoding: 'utf8' })

      expect(fs.existsSync(output)).toBe(true)

      const outputContent = fs.readFileSync(output, 'utf8')
      expect(outputContent).toContain('<svg')
      expect(outputContent).toContain('viewBox=')

      // Clean up
      fs.unlinkSync(output)
    })

    it('should handle custom buffer', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = execSync(`node ${cli} ${input} --dry-run -b 5`, { encoding: 'utf8' })

      expect(result).toContain('with 5px buffer')
    })

    it('should handle zero buffer', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = execSync(`node ${cli} ${input} --dry-run -b 0`, { encoding: 'utf8' })

      expect(result).toContain('with 0px buffer')
    })
  })

  describe('Animation handling', () => {
    it('should detect animations', async () => {
      const input = path.join(fixturesDir, 'animated-rect.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      expect(result.elements.count).toBe(1)
      expect(result.elements.animationCount).toBe(1)
      expect(result.elements.details).toHaveLength(1)
      expect(result.elements.details[0].animations).toBe(1)
    })

    it('should handle symbol/use patterns', async () => {
      const input = path.join(fixturesDir, 'symbol-use.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      expect(result.elements.count).toBe(1)
      expect(result.elements.details).toHaveLength(1)
    })
  })

  describe('Error handling', () => {
    it('should handle SVG without viewBox', () => {
      const input = path.join(fixturesDir, 'no-viewbox.svg')

      expect(() => {
        execSync(`node ${cli} ${input} --dry-run`, { stdio: 'pipe' })
      }).toThrow()
    })

    it('should handle empty SVG', async () => {
      const input = path.join(fixturesDir, 'empty.svg')
      const result = await calculateOptimization(input, { buffer: 10 })

      expect(result.elements.count).toBe(0)
    })
  })

  describe('Debug output', () => {
    it('should show debug information when requested', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = execSync(`node ${cli} ${input} --dry-run --debug`, { encoding: 'utf8' })

      expect(result).toContain('Elements found:')
    })

    it('should not show debug information by default', () => {
      const input = path.join(fixturesDir, 'simple-rect.svg')
      const result = execSync(`node ${cli} ${input} --dry-run`, { encoding: 'utf8' })

      expect(result).not.toContain('Elements found:')
    })
  })
})

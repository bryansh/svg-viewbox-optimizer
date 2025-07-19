const {
  parsePath,
  calculatePathBounds,
  calculateMotionValuesBounds,
  parseMotionValues
} = require('../svg-path-parser')

describe('SVG Path Parser', () => {
  describe('Path parsing', () => {
    it('should parse simple move and line commands', () => {
      const commands = parsePath('M 10,20 L 30,40')
      expect(commands).toHaveLength(2)
      expect(commands[0]).toEqual({ type: 'M', args: [10, 20] })
      expect(commands[1]).toEqual({ type: 'L', args: [30, 40] })
    })

    it('should parse cubic bezier curves', () => {
      const commands = parsePath('M 0,0 C 10,0 20,20 30,20')
      expect(commands).toHaveLength(2)
      expect(commands[1]).toEqual({ type: 'C', args: [10, 0, 20, 20, 30, 20] })
    })

    it('should parse quadratic bezier curves', () => {
      const commands = parsePath('M 50,200 Q 150,50 250,200')
      expect(commands).toHaveLength(2)
      expect(commands[1]).toEqual({ type: 'Q', args: [150, 50, 250, 200] })
    })

    it('should handle relative commands', () => {
      const commands = parsePath('M 10,10 l 20,30')
      expect(commands).toHaveLength(2)
      expect(commands[1]).toEqual({ type: 'l', args: [20, 30] })
    })

    it('should handle repeated commands', () => {
      const commands = parsePath('M 0,0 L 10,10 20,20 30,30')
      expect(commands).toHaveLength(4)
      expect(commands[1]).toEqual({ type: 'L', args: [10, 10] })
      expect(commands[2]).toEqual({ type: 'L', args: [20, 20] })
      expect(commands[3]).toEqual({ type: 'L', args: [30, 30] })
    })

    it('should handle close path command', () => {
      const commands = parsePath('M 0,0 L 100,0 L 100,100 Z')
      expect(commands).toHaveLength(4)
      expect(commands[3]).toEqual({ type: 'Z', args: [] })
    })
  })

  describe('Bounds calculation', () => {
    it('should calculate bounds for simple line', () => {
      const bounds = calculatePathBounds('M 10,20 L 50,60')
      expect(bounds.minX).toBe(10)
      expect(bounds.maxX).toBe(50)
      expect(bounds.minY).toBe(20)
      expect(bounds.maxY).toBe(60)
    })

    it('should calculate bounds for quadratic curve', () => {
      const bounds = calculatePathBounds('M 50,200 Q 150,50 250,200')
      expect(bounds.minX).toBe(50)
      expect(bounds.maxX).toBe(250)
      expect(bounds.minY).toBeLessThan(200) // Curve should go below start/end points
      expect(bounds.maxY).toBe(200)
    })

    it('should handle empty path', () => {
      const bounds = calculatePathBounds('')
      expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
    })

    it('should handle single point', () => {
      const bounds = calculatePathBounds('M 100,150')
      expect(bounds.minX).toBe(100)
      expect(bounds.maxX).toBe(100)
      expect(bounds.minY).toBe(150)
      expect(bounds.maxY).toBe(150)
    })

    it('should calculate bounds for complex path', () => {
      // Path from our test-motion.svg
      const bounds = calculatePathBounds('M 50,200 Q 150,50 250,200 T 350,150')
      expect(bounds.minX).toBe(50)
      expect(bounds.maxX).toBe(350)
      expect(bounds.minY).toBeLessThan(150) // Should capture curve extrema
      expect(bounds.maxY).toBeGreaterThan(200)
    })
  })

  describe('Motion values parsing', () => {
    it('should parse coordinate pairs', () => {
      const coords = parseMotionValues('10,20; 30,40; 50,60')
      expect(coords).toHaveLength(3)
      expect(coords[0]).toEqual({ x: 10, y: 20 })
      expect(coords[1]).toEqual({ x: 30, y: 40 })
      expect(coords[2]).toEqual({ x: 50, y: 60 })
    })

    it('should handle space-separated coordinates', () => {
      const coords = parseMotionValues('10 20; 30 40; 50 60')
      expect(coords).toHaveLength(3)
      expect(coords[0]).toEqual({ x: 10, y: 20 })
    })

    it('should calculate bounds for motion values', () => {
      const bounds = calculateMotionValuesBounds('20,350; 80,320; 140,350; 200,320; 260,350')
      expect(bounds.minX).toBe(20)
      expect(bounds.maxX).toBe(260)
      expect(bounds.minY).toBe(320)
      expect(bounds.maxY).toBe(350)
    })

    it('should handle empty values', () => {
      const bounds = calculateMotionValuesBounds('')
      expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
    })
  })

  describe('Edge cases', () => {
    it('should handle malformed path data gracefully', () => {
      const bounds = calculatePathBounds('M invalid data L')
      expect(bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 })
    })

    it('should handle scientific notation', () => {
      const commands = parsePath('M 1e2,2.5e1 L 3.14e0,2.71e0')
      expect(commands).toHaveLength(2)
      expect(commands[0].args[0]).toBe(100) // 1e2
      expect(commands[0].args[1]).toBe(25) // 2.5e1
    })

    it('should handle negative coordinates', () => {
      const bounds = calculatePathBounds('M -50,-100 L 50,100')
      expect(bounds.minX).toBe(-50)
      expect(bounds.maxX).toBe(50)
      expect(bounds.minY).toBe(-100)
      expect(bounds.maxY).toBe(100)
    })
  })
})

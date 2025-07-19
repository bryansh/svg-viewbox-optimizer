// Test setup file for Jest
// This runs before each test file

// Increase timeout for integration tests that use Puppeteer
jest.setTimeout(30000)

// Mock console.log for cleaner test output (optional)
// const originalConsoleLog = console.log
// console.log = jest.fn()

// You can restore it in specific tests if needed:
// console.log = originalConsoleLog

# Changelog

All notable changes to this project will be documented in this file.

## [1.2.2] - 2025-07-21

### Added
- **Event-Triggered Animation Support**:
  - Full support for interactive animation triggers (click, mouseover, focus, touchstart, etc.)
  - Element-based timing support (anim.end, anim.begin)
  - Complex timing expressions (click+0.5s, indefinite)
  - Static analysis approach - no need to actually trigger events
  - Conservative bounds calculation includes all potential animation states

- **External Stylesheet Support**:
  - Automatic inlining of external CSS files referenced via `<link>` elements
  - Recursive processing of `@import` statements within style blocks
  - Path resolution relative to SVG file location
  - Graceful error handling for missing stylesheets
  - Console logging of inlined stylesheets for debugging

### Technical Details
- Enhanced animation timing parser to detect and handle event-based triggers
- Event-triggered animations treated as starting at time 0 for bounds calculation
- Created `StylesheetProcessor` class for preprocessing external CSS references
- External stylesheets converted to inline `<style>` blocks before browser analysis

### Testing
- Added 4 comprehensive test cases for new features
- Test coverage increased to 100 tests passing
- Verified support for all standard DOM events and CSS loading scenarios

## [1.2.1] - 2025-07-20

### Added
- **Nested SVG Support**:
  - Complete coordinate transformation for deeply nested SVG elements
  - Recursive processing with accumulated transforms
  - Proper viewport scaling and viewBox transformations
  - Animation support within nested coordinate systems

- **Comprehensive Test Coverage**:
  - Achieved 100% test coverage with 96 passing tests across 7 test suites
  - Mathematical verification of all test expectations against SVG geometry
  - Complete coverage of animation, transform, effects, and nested SVG scenarios

### Fixed
- **Motion Path Animation Bounds**: Fixed complex motion path calculations to properly handle coordinate transformations
- **Additive Animation Combining**: Resolved overlapping additive animations to combine correctly using matrix multiplication
- **Filter Effects Integration**: Fixed filter effects to apply to animated bounds rather than static bounds
- **Deeply Nested SVG Processing**: Added recursive processing for arbitrarily nested SVG structures
- **Linting Issues**: Resolved all JavaScript Standard Style compliance issues

### Architecture
- **Browser Module System**: Improved separation between browser-optimized and Node.js modules
- **Module Cache System**: Enhanced browser bundle with efficient module caching
- **Case Block Declarations**: Fixed linting warnings in switch statements with proper block scoping

### Quality Assurance
- **Mathematical Accuracy**: All test expectations verified against manual geometric calculations
- **Edge Case Coverage**: Comprehensive testing of complex nested animations and transformations
- **Code Quality**: Zero linting errors with JavaScript Standard Style compliance

## [1.2.0] - 2025-07-20

### Added
- **Hidden Element Handling**:
  - Automatically excludes elements with `display="none"` from viewBox calculations
  - Excludes elements with `visibility="hidden"` 
  - Excludes elements with `opacity="0"`
  - Supports CSS style-based hiding (inline styles and computed styles)
  - Proper parent inheritance - children of hidden parents are excluded
  - Uses browser's `getComputedStyle()` API for accurate CSS cascade handling

- **Enhanced API**:
  - Added `newViewBox` object with `x`, `y`, `width`, `height` properties for easier programmatic access
  - Maintains backward compatibility with string-based `optimized.viewBox`

### Tests
- Added 6 comprehensive test cases for hidden element scenarios
- Tests cover attribute-based hiding, CSS styles, and parent inheritance

## [1.1.0] - 2025-07-19

### Added
- **Modular Architecture**: Separated concerns into 7 specialized modules
  - `transform-parser.js` - 2D matrix transformation system
  - `animation-analyzer.js` - Comprehensive animation analysis
  - `effects-analyzer.js` - Filter, mask, clipPath effects analysis
  - `animation-combiner.js` - Overlapping animation combination
  - `svg-path-parser.js` - SVG path data parsing with Bezier mathematics
  - `bounds-calculator.js` - Precise element bounds calculation
  - `container-detector.js` - Generic container vs content detection

- **Enhanced Transform Support**: 
  - Complete 2D matrix mathematics for all transform types
  - Support for `translate`, `scale`, `rotate`, `skew`, `matrix` transforms
  - Proper cumulative transform handling from element to root
  - Corner-based bounding box transformation

- **Advanced Animation Analysis**:
  - Normalized value parsing with structured objects
  - Support for `calcMode` (linear, discrete, paced, spline)
  - Enhanced keyframes parsing with proper defaults
  - Support for `animateTransform`, `animate`, `animateMotion`

- **Enhanced Animation Integration**:
  - Sophisticated browser-side animation processing
  - Fixed NaN bounds calculation in complex animations
  - Proper object handling for matrix transformations
  - Improved bounds calculation for all animation types

- **Path Morphing Support**:
  - Complete `d` attribute animation parsing for shape morphing
  - Union bounds calculation across all morphing states
  - Support for stroke-only animated paths with zero static bounds
  - Enhanced element filtering to include animated elements

- **Complex Transform Support**:
  - Complete matrix transform parsing and application
  - Support for all transform types: translate, scale, rotate, skew, matrix
  - Proper nested transform inheritance handling
  - Enhanced transform bounds calculation with mathematical precision

- **Overlapping Animation Support**:
  - Intelligent animation combiner for multiple animations on same element
  - Proper additive animation combining using matrix multiplication
  - Separate handling of additive vs non-additive animations
  - Time sampling for accurate bounds across all animation states

- **Comprehensive Effects Support**:
  - Complete SVG filter analysis with region and primitive parsing
  - CSS filter function support with robust non-regex parsing
  - Directional bounds expansion for drop shadows and offsets
  - Safe mask and clipPath handling with full bounds preservation
  - Mathematical precision for blur radius calculations (3× standard deviation)

- **Transform Support for All Elements**:
  - Fixed critical bug where transforms only applied to use elements
  - All visual elements now properly inherit cumulative transforms
  - Supports nested groups with correct transform concatenation
  - Added foreignObject element support with attribute-based bounds

- **Generic Container Detection**:
  - Automatic symbol container identification
  - No hardcoded element-specific logic
  - Works with any SVG structure and nesting

### Changed
- **Breaking**: Minimum Node.js version updated to 18.0.0
- **Internal**: Complete refactor from monolithic to modular architecture
- **Performance**: More efficient bounds calculation with matrix operations

### Removed
- **Technical Debt**: Eliminated all hardcoded values and SVG-specific logic
- **Legacy**: Removed manual container corrections (preserved in `viewbox-calculator-legacy.js`)

### Fixed
- **Accuracy**: More precise bounds calculation for rotated and scaled elements
- **Robustness**: Better handling of edge cases in transform parsing
- **Maintainability**: Clean separation of parsing from matrix calculations
- **Transform Inheritance**: Fixed critical bug where only use elements had transforms applied
- **Filter Calculations**: Fixed pixel vs percentage expansion mixing in filter effects
- **Element Support**: Added proper bounds handling for foreignObject elements

---

## [1.0.0] - 2024-12-01

### Added
- Initial release with basic SVG viewBox optimization
- Support for simple `translate` transforms
- Animation bounds calculation for `animateTransform`
- CLI interface with Puppeteer-based browser automation
- Comprehensive test suite
- GitHub Actions CI/CD pipeline

### Features
- Browser-based `getBBox()` API usage
- Basic symbol and `<use>` element handling  
- Configurable padding buffer
- Detailed optimization reporting
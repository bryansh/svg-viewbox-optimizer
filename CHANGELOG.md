# Changelog

All notable changes to this project will be documented in this file.

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
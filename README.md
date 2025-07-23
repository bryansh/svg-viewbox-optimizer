# SVG ViewBox Optimizer

[![CI](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml)

A command-line tool that optimizes SVG viewBox attributes by calculating the minimal bounding box around all visible and animated content. This can significantly reduce the SVG coordinate space, improving rendering performance and reducing file sizes.

## Features

- 🎯 **Precise bounds calculation** using browser's native `getBBox()` API with visual overflow detection
- 🎬 **Animation-aware** - supports both SMIL and CSS @keyframes animations with accurate motion path calculation
- 🔍 **Smart symbol handling** - correctly processes `<use>` elements with full viewBox coordinate transformation
- 🔧 **Advanced transform support** - handles translate, scale, rotate, skew, and matrix transforms on ALL elements
- 🎨 **Pattern visual bounds** - detects and includes pattern content that extends beyond pattern tiles
- 🎭 **Generic container detection** - automatically identifies and processes container vs. content elements
- 🧠 **Enhanced animation integration** - sophisticated browser-side animation processing with normalized value parsing
- ✨ **Effects support** - handles filter, mask, and clipPath effects with accurate bounds expansion
- 🏗️ **Nested SVG support** - proper coordinate transformation for deeply nested SVG elements
- 📊 **Detailed reporting** - shows space savings and element analysis
- 🛡️ **Safe defaults** - adds configurable padding around content
- 🏗️ **Modular architecture** - extensible design for complex SVG processing

### Advanced Features (New!)

- 🎨 **CSS @keyframes animation support** - Full CSS animation analysis with transform-origin handling and multi-keyframe bounds calculation
- 🔀 **Switch element support** - Handles conditional rendering with `<switch>`, `requiredFeatures`, `requiredExtensions`, and `systemLanguage`
- 🌐 **ForeignObject HTML layout** - Accurately measures HTML content inside `<foreignObject>` elements, accounting for overflow
- ⏱️ **Script-generated content** - Configurable delay to capture dynamically added SVG elements via JavaScript
- 🔤 **Web font synchronization** - Waits for web fonts to load before measuring text bounds
- ✅ **100% test coverage** - comprehensive test suite with 204 passing tests

## Installation

```bash
npm install -g svg-viewbox-optimizer
```

Or run directly with npx:

```bash
npx svg-viewbox-optimizer input.svg
```

## Usage

### Basic usage

```bash
svg-optimize input.svg
```

This will create `input_optimized.svg` with the optimized viewBox.

### Options

```bash
svg-optimize input.svg [options]
```

- `-o, --output <file>` - Output filename (default: `input_optimized.svg`)
- `-b, --buffer <pixels>` - Buffer padding around content in pixels (default: `10`)
- `-s, --script-delay <ms>` - Wait time for script-generated content in milliseconds (default: `0`)
- `-f, --font-timeout <ms>` - Maximum wait time for web fonts in milliseconds (default: `5000`)
- `--no-fail-on-font-timeout` - Continue even if font loading times out
- `--dry-run` - Preview optimization without writing file
- `--debug` - Show detailed calculation information
- `-h, --help` - Display help
- `-V, --version` - Display version

### Examples

Preview optimization with custom buffer:
```bash
svg-optimize icon.svg --dry-run --buffer 5
```

Save with custom filename:
```bash
svg-optimize logo.svg -o logo-optimized.svg
```

Wait for dynamically generated content:
```bash
svg-optimize dashboard.svg --script-delay 2000
```

Handle SVGs with web fonts:
```bash
svg-optimize typography.svg --font-timeout 3000 --no-fail-on-font-timeout
```

Debug mode to see calculation details:
```bash
svg-optimize animation.svg --debug --dry-run
```

Combine multiple options:
```bash
svg-optimize interactive.svg -b 15 -s 1000 -f 2000 --debug -o final.svg
```

## How it works

The optimizer uses a **modular architecture** for robust SVG analysis:

1. **Load & Parse**: Loads your SVG in a headless browser (Puppeteer)
2. **Container Detection**: Automatically identifies container vs. content elements
3. **Transform Analysis**: Parses all transform types using 2D matrix mathematics
4. **Animation Processing**: Analyzes `animateTransform`, `animate`, and `animateMotion` elements
5. **Bounds Calculation**: Uses browser's `getBBox()` API with transform matrices
6. **Optimization**: Calculates minimal bounding box containing all animated content
7. **Output**: Updates the viewBox attribute with optimized values

### Supported Element Types

- **Basic shapes** - rect, circle, ellipse, line, polyline, polygon
- **Paths** - Complex path elements with full SVG path syntax  
- **Text** - Text elements with proper bounds calculation
- **Images** - Embedded images with correct dimensions
- **Groups** - g elements with nested content and transforms
- **foreignObject** - HTML/XML content embedded in SVG
- **use** - Symbol references with complete viewBox coordinate transformation
- **Symbol chains** - Deeply nested symbol references with proper coordinate system handling
- **Nested SVG** - Proper coordinate system transformations with recursive processing
- **Markers** - Arrow heads and line decorations with accurate positioning
- **Patterns** - Pattern fills with visual overflow detection

### Pattern Visual Bounds Support

- **Visual overflow detection** - Analyzes pattern content to detect elements that extend beyond pattern tile boundaries
- **Automatic bounds expansion** - Expands element bounds to include pattern content that renders outside geometric bounds
- **Complex pattern analysis** - Handles patterns with multiple shapes, transforms, and opacity
- **Performance optimized** - Only analyzes patterns when needed, maintains fast processing

Example: A pattern with a circle that extends beyond its tile will have its visual bounds properly calculated:
```xml
<pattern id="overflowPattern" width="20" height="20">
  <!-- This circle extends 10px beyond the pattern tile -->
  <circle cx="10" cy="10" r="20" fill="red"/>
</pattern>
<rect fill="url(#overflowPattern)" ... />
```

### Symbol ViewBox Coordinate Transformations

- **Complete viewBox support** - Handles symbols with their own coordinate systems and aspect ratio settings
- **Accurate scaling calculations** - Properly processes `meet`, `slice`, and `none` scaling behaviors  
- **Alignment precision** - Supports all nine alignment modes (xMinYMin, xMidYMid, etc.)
- **Nested coordinate systems** - Correctly transforms bounds through multiple symbol layers

Example: A symbol with viewBox that gets scaled by a use element:
```xml
<symbol id="icon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
  <rect x="10" y="10" width="80" height="80" fill="blue"/>
</symbol>
<use href="#icon" x="50" y="50" width="200" height="150"/>
<!-- Properly calculates the scaled and positioned bounds -->

### CSS and Styling Support

- **Inline styles** - `style="transform: rotate(45deg)"`
- **Internal `<style>` blocks** - CSS rules within the SVG document
- **External stylesheets** - Automatic inlining of `<link href="styles.css" ...>`
- **@import statements** - Recursive processing of CSS imports
- **CSS transforms** - Full support via `getComputedStyle()` API
- **Transform priority** - CSS transforms take precedence over SVG attributes

### preserveAspectRatio Support

- **All alignment modes** - `xMinYMin`, `xMidYMin`, `xMaxYMin`, `xMinYMid`, `xMidYMid`, `xMaxYMid`, `xMinYMax`, `xMidYMax`, `xMaxYMax`
- **Scaling behaviors** - `meet` (scale to fit entirely), `slice` (scale to fill viewport), `none` (non-uniform scaling)
- **Default behavior** - Missing `preserveAspectRatio` defaults to `"xMidYMid meet"` per SVG specification
- **Nested SVG support** - Proper aspect ratio handling for deeply nested SVG elements
- **Viewport alignment** - Correct positioning within viewport based on alignment specification
- **Edge case handling** - Graceful handling of zero dimensions and invalid viewBox values

### Hidden Element Handling

The optimizer automatically excludes hidden elements from viewBox calculations:

- **display="none"** - Elements removed from layout
- **visibility="hidden"** - Invisible elements
- **opacity="0"** - Fully transparent elements
- **CSS styles** - Computed styles including cascaded rules
- **Parent inheritance** - Children of hidden parents are excluded

### Supported Transform Types

- **translate(x, y)** - Element positioning
- **scale(x, y)** - Element scaling
- **rotate(angle, cx, cy)** - Element rotation around point
- **skewX(angle)** / **skewY(angle)** - Element skewing
- **matrix(a, b, c, d, e, f)** - Direct matrix transformations
- **Cumulative transforms** - Properly handles nested transform inheritance
- **Overlapping animations** - Intelligent combining of multiple animations on same element

### Supported Animation Types

- **animateTransform** - Transform animations with all calcModes (linear, discrete, paced, spline)
- **animate** - Attribute animations (x, y, width, height, opacity, etc.) 
- **animateMotion** - Path-based motion animations with mpath references and coordinate values
- **Path morphing** - Shape animations using `d` attribute with precise bounds calculation
- **Overlapping animations** - Multiple simultaneous animations with proper additive combining
- **Nested SVG animations** - Animations within nested coordinate systems with proper transformation
- **Event-triggered animations** - Animations with interactive triggers (click, mouseover, focus, etc.)
- **Complex timing** - Element-based timing (anim.end), offsets (click+0.5s), and indefinite begin
- **Keyframe analysis** - Proper keyTimes and calcMode support across all animation types

### Supported Effects

- **SVG Filters** - Complete support for filter definitions with region calculation and primitive analysis
  - `feGaussianBlur` - Blur effects with accurate radius expansion
  - `feDropShadow` - Drop shadow effects with directional offset calculation
  - `feOffset` - Element offset transformations
  - `feMorphology` - Dilate and erode operations
- **CSS Filters** - Modern CSS filter functions with robust parsing
  - `blur()` - CSS blur with mathematical precision
  - `drop-shadow()` - CSS drop shadows with complex parameter handling
- **Masks and ClipPaths** - Safe bounds preservation for masked/clipped content
  - `mask` - URL references to mask definitions
  - `clip-path` - URL references and CSS functions (circle, polygon, etc.)

### Example Results

Original SVG with wasteful viewBox:
```xml
<svg viewBox="0 0 512 512">
  <!-- Icon centered in large coordinate space -->
</svg>
```

Optimized SVG with tight viewBox:
```xml
<svg viewBox="43.54 138.08 441.66 340.82">
  <!-- Same icon with ~42% less coordinate space -->
</svg>
```

## API Usage

You can also use the optimizer programmatically:

```javascript
const { calculateOptimization } = require('svg-viewbox-optimizer/viewbox-calculator');

async function optimizeSVG() {
  const result = await calculateOptimization('input.svg', {
    buffer: 10,
    debug: false,
    scriptDelay: 1000,  // Wait 1 second for script-generated content
    fontTimeout: 5000,  // Max 5 seconds for web fonts
    failOnFontTimeout: true  // Error if fonts take too long
  });
  
  console.log(result.optimized.viewBox); // "43.54 138.08 441.66 340.82"
  console.log(result.savings.percentage); // 42.6
  
  // New viewBox object for easier programmatic access
  console.log(result.newViewBox); 
  // { x: 43.54, y: 138.08, width: 441.66, height: 340.82 }
}
```

## Architecture

The tool uses a **modular design** for maintainability and extensibility:

```
svg-viewbox-optimizer/
├── viewbox-calculator.js      # Main calculation engine
├── src/
│   ├── browser/               # Browser-optimized modules
│   │   ├── svg-analyzer.js    # Main SVG analysis orchestrator
│   │   ├── bounds-calculator.js # Element bounds calculation
│   │   └── visibility-checker.js # Hidden element detection
│   ├── lib/                   # Node.js modules (auto-processed for browser)
│   │   ├── transform-parser.js # 2D matrix transform system
│   │   ├── animation-analyzer.js # Animation parsing & analysis
│   │   ├── effects-analyzer.js # Filter, mask, clipPath effects analysis
│   │   ├── animation-combiner.js # Overlapping animation combination
│   │   ├── svg-path-parser.js # SVG path data parsing with Bezier math
│   │   ├── pattern-analyzer.js # Pattern visual bounds analysis
│   │   ├── symbol-viewbox-analyzer.js # Symbol coordinate transformation analysis
│   │   └── stylesheet-processor.js # External CSS inlining
│   └── browser-bundle.js      # Module loader and browser compatibility
└── index.js                   # CLI interface
```

Each module handles a specific aspect of SVG analysis, making the tool:
- **Maintainable** - Clean separation of concerns
- **Testable** - Individual modules can be tested in isolation
- **Extensible** - Easy to add new transform types or animation support
- **Reliable** - Robust error handling and fallbacks

## Requirements

- Node.js 18 or higher
- Puppeteer (automatically installed)

## Development

```bash
# Clone the repository
git clone https://github.com/bryansh/svg-viewbox-optimizer.git
cd svg-viewbox-optimizer

# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Test with sample SVG
npm run test:sample

# Run with local changes
node index.js test.svg --dry-run
```

### Test Coverage

The project maintains **100% test coverage** with comprehensive test suites:

```bash
npm test
# 189 tests passing across 16 test suites
# ✅ CLI interface tests
# ✅ Optimization algorithm tests  
# ✅ Nested SVG coordinate transformation tests
# ✅ CSS transform and matrix tests
# ✅ Edge case handling tests
# ✅ SVG path parser tests
# ✅ Marker bounds calculation tests
# ✅ Pattern overflow and visual bounds tests
# ✅ Symbol viewBox coordinate transformation tests
# ✅ preserveAspectRatio support tests
# ✅ Event-triggered animation tests
# ✅ External stylesheet tests
# ✅ Symbol chain positioning tests
```

All test expectations have been mathematically verified against the actual SVG structures and geometric calculations.

### Testing Complex SVGs

The tool handles various SVG complexities:

```bash
# Test with transforms
node index.js examples/complex-transforms.svg --debug

# Test with animations  
node index.js examples/animated-icon.svg --debug

# Test with nested symbols
node index.js examples/symbol-library.svg --debug
```

## Testing

The project includes comprehensive test coverage with different test suites:

```bash
# Run standard tests (excludes timing-sensitive and external dependency tests)
npm test

# Run all tests including timing-sensitive tests  
npm run test:all

# Run timing-sensitive tests (web fonts, foreign object timing)
npm run test:timing

# Run only web font tests
npm run test:webfont

# Run only performance/timing tests
npm run test:perf

# Run linting
npm run lint
```

**Test Structure:**
- **Functional tests**: Core SVG processing, feature detection, bounds calculation, pattern overflow, symbol viewBox (193 tests)
- **Web font tests**: Text rendering with external fonts (8 tests - excluded from CI)
- **Foreign object timing tests**: HTML layout timing with external resources (excluded from CI)
- **Performance tests**: Timing validation and benchmarks (excluded from CI)
- **206 total test cases** with comprehensive coverage of edge cases and advanced SVG features

**Note**: Tests with external dependencies (Google Fonts) or timing sensitivities are excluded from CI to ensure reliable builds.

## Contributing

Contributions are welcome! Please ensure tests pass and follow the existing code style:

```bash
npm run lint     # Check code style
npm test         # Run functional tests
npm run test:all # Run all tests including performance
```

## License

MIT © [Your Name]
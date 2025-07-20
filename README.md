# SVG ViewBox Optimizer

[![CI](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml)

A command-line tool that optimizes SVG viewBox attributes by calculating the minimal bounding box around all visible and animated content. This can significantly reduce the SVG coordinate space, improving rendering performance and reducing file sizes.

## Features

- 🎯 **Precise bounds calculation** using browser's native `getBBox()` API
- 🎬 **Animation-aware** - accounts for animated elements' motion paths
- 🔍 **Smart symbol handling** - correctly processes `<use>` elements and nested symbols
- 🔧 **Advanced transform support** - handles translate, scale, rotate, skew, and matrix transforms on ALL elements
- 🎭 **Generic container detection** - automatically identifies and processes container vs. content elements
- 🧠 **Enhanced animation integration** - sophisticated browser-side animation processing with normalized value parsing
- ✨ **Effects support** - handles filter, mask, and clipPath effects with accurate bounds expansion
- 📊 **Detailed reporting** - shows space savings and element analysis
- 🛡️ **Safe defaults** - adds configurable padding around content
- 🏗️ **Modular architecture** - extensible design for complex SVG processing

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

Debug mode to see calculation details:
```bash
svg-optimize animation.svg --debug --dry-run
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
- **use** - Symbol references with transform inheritance
- **Nested SVG** - Proper coordinate system transformations

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
    debug: false
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
├── transform-parser.js        # 2D matrix transform system
├── animation-analyzer.js      # Animation parsing & analysis
├── effects-analyzer.js        # Filter, mask, clipPath effects analysis
├── animation-combiner.js      # Overlapping animation combination
├── svg-path-parser.js         # SVG path data parsing with Bezier math
├── bounds-calculator.js       # Element bounds calculation
├── container-detector.js      # Container vs content detection
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Your Name]
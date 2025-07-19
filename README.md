# SVG ViewBox Optimizer

[![CI](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml/badge.svg)](https://github.com/bryansh/svg-viewbox-optimizer/actions/workflows/ci.yml)

A command-line tool that optimizes SVG viewBox attributes by calculating the minimal bounding box around all visible and animated content. This can significantly reduce the SVG coordinate space, improving rendering performance and reducing file sizes.

## Features

- 🎯 **Precise bounds calculation** using browser's native `getBBox()` API
- 🎬 **Animation-aware** - accounts for animated elements' motion paths
- 🔍 **Smart symbol handling** - correctly processes `<use>` elements and nested symbols
- 📊 **Detailed reporting** - shows space savings and element analysis
- 🛡️ **Safe defaults** - adds configurable padding around content

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

The optimizer:

1. Loads your SVG in a headless browser (Puppeteer)
2. Uses the browser's `getBBox()` API to get precise element boundaries
3. Accounts for all transformations and animations
4. Calculates the minimal bounding box containing all content
5. Adds the specified buffer padding
6. Updates the viewBox attribute with optimized values

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
}
```

## Requirements

- Node.js 14 or higher
- Puppeteer (automatically installed)

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/svg-viewbox-optimizer.git
cd svg-viewbox-optimizer

# Install dependencies
npm install

# Run tests
npm test

# Run with local changes
node index.js test.svg --dry-run
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT © [Your Name]
#!/usr/bin/env node
const { Command } = require('commander')

const fs = require('fs')
const chalk = require('chalk')
const { calculateOptimization } = require('./viewbox-calculator')

const program = new Command()

program
  .name('svg-optimize')
  .description('Optimize SVG viewBox to minimize whitespace around animated content')
  .version('1.3.0')
  .argument('<input>', 'input SVG file')
  .option('-o, --output <file>', 'output file (default: input_optimized.svg)')
  .option('-b, --buffer <pixels>', 'buffer padding around content', '10')
  .option('--dry-run', 'show results without writing file')
  .option('--debug', 'show debug information')
  .parse()

const options = program.opts()
const inputFile = program.args[0]

if (!fs.existsSync(inputFile)) {
  console.error(chalk.red(`Error: File ${inputFile} not found`))
  process.exit(1)
}

async function optimizeSVG () {
  try {
    console.log(chalk.blue('Analyzing SVG...'))

    const result = await calculateOptimization(inputFile, options)

    // Display results using the structured data
    console.log(`Original viewBox: ${result.original.viewBox}`)
    console.log(`Original area: ${result.original.width}x${result.original.height} = ${result.original.area.toLocaleString()} units²`)
    console.log(`Found ${result.elements.count} elements, ${result.elements.animationCount} animations`)

    if (options.debug && result.elements.details) {
      console.log('\nElements found:')
      result.elements.details.forEach(el => {
        console.log(`  - ${el.id} (${el.animations} animations)`)
      })
    }

    console.log(chalk.green('\nOptimization Results:'))
    console.log(`New viewBox: ${result.optimized.viewBox}`)
    console.log(`Content dimensions: ${result.content.width.toFixed(1)}x${result.content.height.toFixed(1)} (without buffer)`)
    console.log(`ViewBox dimensions: ${result.optimized.width.toFixed(1)}x${result.optimized.height.toFixed(1)} (with ${result.buffer}px buffer)`)
    console.log(`New area: ${result.optimized.area.toLocaleString()} units²`)
    console.log(`Space savings: ${chalk.bold.green(result.savings.percentage.toFixed(1) + '%')}`)

    if (!options.dryRun) {
      // Update the SVG with new viewBox
      const svgContent = fs.readFileSync(inputFile, 'utf8')
      const updatedSvg = svgContent.replace(
        /viewBox="[^"]*"/,
        `viewBox="${result.optimized.viewBox}"`
      )

      const outputFile = options.output || inputFile.replace('.svg', '_optimized.svg')
      fs.writeFileSync(outputFile, updatedSvg)
      console.log(chalk.green(`\nOptimized SVG saved to: ${outputFile}`))
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message)
    process.exit(1)
  }
}

optimizeSVG()

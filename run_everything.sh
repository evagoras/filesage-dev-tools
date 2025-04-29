#!/bin/bash

set -e

# Print current Node.js version
echo "Using Node.js version: $(node --version)"

# Create necessary folders
mkdir -p benchmarks
mkdir -p plots
mkdir -p temp

# Run benchmarks
echo "Running Text File Benchmarks..."
npm run bench:text
echo "✅ Text file benchmarks completed."

echo "Running Binary File Benchmarks..."
npm run bench:binary
echo "✅ Binary file benchmarks completed."

# Generate plots
echo "Generating Performance Graphs..."
npm run plot
echo "✅ Graphs generated."

echo ""
echo "🎯 All benchmarks completed and saved to /benchmarks/"
echo "🎯 All plots generated and saved to /plots/"
echo "✅ Done!"

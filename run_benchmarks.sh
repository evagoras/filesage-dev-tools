#!/bin/bash

set -e

mkdir -p benchmarks
mkdir -p plots
mkdir -p temp
mkdir -p assets

echo "Running Text File Benchmarks..."
npx ts-node scripts/benchmark_text_files.ts

echo "Running Binary File Benchmarks..."
npx ts-node scripts/benchmark_binary_files.ts

echo "Running Local vs URL File Benchmarks..."
npx ts-node scripts/benchmark_local_vs_url.ts

echo "Running Plotting Script (TypeScript)..."
npx ts-node scripts/generate_plots.ts

echo "✅ All benchmarks completed and saved to /benchmarks/"
echo "✅ All plots generated and saved to /plots/"

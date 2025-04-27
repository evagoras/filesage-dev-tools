#!/bin/bash

set -e

mkdir -p benchmarks
mkdir -p plots

echo "Running Text File Benchmarks..."
npx ts-node scripts/benchmark_text_files.ts

echo "Running Binary File Benchmarks..."
npx ts-node scripts/benchmark_binary_files.ts

echo "Running Plotting Script..."
python3 scripts/plot_file_comparison.py

echo "✅ Benchmarks saved to /benchmarks/; graphs saved to /plots/"

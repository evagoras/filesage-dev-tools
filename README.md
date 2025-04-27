# FileSage Dev Tools

Benchmarking and tuning utilities for FileSage.

## Features

- Benchmark text and binary file comparisons
- Auto-detect best size cutoff
- Plot performance graphs
- Suggest constants for production

## Project Structure

/scripts/
    benchmark_text_files.ts
    benchmark_binary_files.ts
    plot_file_comparison.py
/benchmarks/ (auto-generated CSVs)
/plots/ (auto-generated PNGs)

## Usage

cd filesage-dev-tools
bash run_benchmarks.sh

## Requirements

- Node.js >=18
- Python 3 (with pandas, matplotlib)

## License

MIT

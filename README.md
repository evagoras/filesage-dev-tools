# FileSage Dev Tools

Benchmarking and tuning utilities for FileSage.

## Features

- Benchmark text file comparisons (string, buffer, hash)
- Benchmark binary file comparisons (buffer, hash)
- Benchmark local file vs remote URL file comparisons
- Auto-detect best size cutoff
- Plot performance graphs automatically
- Suggest constants for production tuning
- Clean project structure, fully scriptable

## Project Structure

```
/filesage-dev-tools/
  /scripts/
    benchmark_text_files.ts
    benchmark_binary_files.ts
    benchmark_local_vs_url.ts
    plot_file_comparison.py
    utils.ts
  /benchmarks/ (auto-generated CSVs)
  /plots/ (auto-generated PNGs)
  /temp/ (auto temp downloads)
  /assets/ (sample local files)
  run_benchmarks.sh
  package.json
  settings.json
  tsconfig.json
```

✅ All benchmarks and plots are fully automated.

## Usage

### 1. Install dependencies

```
cd filesage-dev-tools
npm install
```

(Also make sure you have Python 3 with pandas and matplotlib.)

`pip install pandas matplotlib`

### 2. Run all benchmarks and plots

`bash run_benchmarks.sh`

This will:
- Run text file benchmarks
- Run binary file benchmarks
- Run local-vs-URL file benchmarks
- Plot performance graphs automatically

✅ Results are saved into `/benchmarks/` and `/plots/`.

### 3. Available npm scripts

Command             | What it does
---------------------|------------------------
npm run build        | Compile TypeScript files
npm run bench:text   | Run only text file benchmarks
npm run bench:binary | Run only binary file benchmarks
npm run bench:url    | Run only local-vs-url benchmarks
npm run bench:all    | Run all benchmarks and plots
npm run plot         | Plot graphs only from latest CSVs
npm run clean        | Clean /benchmarks/, /plots/, /temp/ folders

✅ Use these for partial runs during development.

## Requirements

- Node.js >=18
- Python 3 (with pandas, matplotlib installed)

## License

MIT

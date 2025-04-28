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

## Usage

### 1. Install dependencies

```
cd filesage-dev-tools
npm install
```

### 2. Run all benchmarks and plots

`bash run_benchmarks.sh`

This will:
- Run text file benchmarks
- Run binary file benchmarks
- Run local-vs-URL file benchmarks
- Plot performance graphs automatically

✅ Results are saved into `/benchmarks/` and `/plots/`.

### Notes on Local vs URL HEAD Check Benchmarks

- For the `bench:urlhead` benchmark, the system first sends a lightweight HTTP HEAD request to the remote URL.
- It compares the `Content-Length` header of the remote file against the local file size.
- If the sizes match, it assumes the files are identical and **skips full download and content comparison** for maximum speed.
- If the sizes differ, it proceeds to download the remote file and performs full buffer and hash comparisons.
- This provides extremely fast verification for matching files with minimal network usage.

### 3. Available npm scripts

Command               | What it does
----------------------|------------------------
npm run build         | Compile TypeScript files
npm run bench:text    | Run only Text file benchmarks
npm run bench:binary  | Run only Binary file benchmarks
npm run bench:url     | Run only Local vs URL full download benchmarks
npm run bench:urlhead | Run only Local vs URL HEAD check benchmarks
npm run plot          | Generate plots only from CSVs
npm run bench:all     | Run all benchmarks and plots
npm run clean         | Clean `/benchmarks/`, `/plots/`, `/temp/` folders

✅ Use these for partial runs during development.

## Requirements

- Node.js >= 22

## License

MIT

# Installation & Setup Guide

## ✅ What's Built

You now have **4 custom n8n nodes** for machine learning with scikit-learn:

1. **Sklearn Linear Regression** - Train & predict
2. **Sklearn Standard Scaler** - Normalize features
3. **Sklearn Datasets** - Load sample ML datasets
4. **Sklearn MLflow** - Track experiments with MLflow

## Prerequisites

### 1. Python & Packages

```bash
# Check Python version (3.7+ required)
python3 --version

# Install scikit-learn and numpy
pip3 install scikit-learn numpy

# Optional: Install MLflow for experiment tracking
pip3 install mlflow
```

### 2. Verify Installation

```bash
python3 -c "import sklearn, numpy; print(f'sklearn: {sklearn.__version__}, numpy: {numpy.__version__}')"
```

Should output something like:
```
sklearn: 1.7.2, numpy: 2.2.6
```

## Installation to n8n

### Current Status

✅ **Already Installed** at: `~/.n8n/custom/node_modules/n8n-nodes-sklearn`

### To Reinstall or Update

```bash
cd /Users/arturovaine/Documents/n8n-nodes-sklearn
npm run build
cp -r /Users/arturovaine/Documents/n8n-nodes-sklearn ~/.n8n/custom/node_modules/
```

## Start Using the Nodes

### 1. Restart n8n

If n8n is running, restart it to load the new nodes:

```bash
# Stop n8n (Ctrl+C if running in terminal)
# Or kill the process
pkill -f n8n

# Start n8n
n8n start
```

### 2. Verify Nodes Appear

1. Open n8n: http://localhost:5678
2. Create a new workflow
3. Click "+" to add a node
4. Search for "Sklearn" - you should see all 4 nodes:
   - Sklearn Datasets
   - Sklearn Linear Regression
   - Sklearn MLflow
   - Sklearn Standard Scaler

## Quick Test Workflow

Create this simple workflow to test everything:

### Workflow 1: Basic Linear Regression

```
1. Manual Trigger
   ↓
2. Sklearn Datasets
   - Dataset: Make Regression
   - Samples: 100
   - Features: 2
   ↓
3. Sklearn Linear Regression
   - Operation: Train
   - Feature Columns: feature_0,feature_1
   - Target Column: target_numeric
   ↓
4. Table (view results)
```

**Expected Output:**
- R² score: ~0.9-1.0
- Coefficients: array of 2 numbers
- Intercept: single number

### Workflow 2: With MLflow Tracking

**First, start MLflow server:**
```bash
mlflow server --host 127.0.0.1 --port 5000
```

**Then create workflow:**
```
1. Manual Trigger
   ↓
2. Sklearn Datasets (Diabetes)
   ↓
3. Sklearn MLflow - Start Run
   - Experiment: diabetes-test
   ↓
4. Sklearn Linear Regression (Train)
   - Features: age,sex,bmi,bp,s1,s2,s3,s4,s5,s6
   - Target: target_numeric
   ↓
5. Sklearn MLflow - Log Metrics
   - Metrics: r2_score
   ↓
6. Sklearn MLflow - End Run
```

**View Results:**
Open http://localhost:5000 to see your experiment in MLflow UI!

## Project Structure

```
n8n-nodes-sklearn/
├── nodes/
│   ├── SklearnDatasets/
│   │   ├── SklearnDatasets.node.ts
│   │   └── sklearn.svg
│   ├── SklearnLinearRegression/
│   │   ├── SklearnLinearRegression.node.ts
│   │   └── sklearn.svg
│   ├── SklearnMlflow/
│   │   ├── SklearnMlflow.node.ts
│   │   └── mlflow.svg
│   └── SklearnStandardScaler/
│       ├── SklearnStandardScaler.node.ts
│       └── sklearn.svg
├── dist/                    # Compiled JavaScript
├── package.json
├── tsconfig.json
├── README.md               # Full documentation
├── QUICKSTART.md           # 5-minute guide
├── SETUP_LOCAL.md          # Detailed setup
├── MLFLOW_GUIDE.md         # MLflow integration
├── DATASETS_GUIDE.md       # Dataset usage
├── TROUBLESHOOTING.md      # Common issues
├── TIPS.md                 # Tips & tricks
├── EXAMPLES.md             # Example workflows
└── test_sklearn.py         # Python tests
```

## Documentation Files

- **README.md** - Complete package documentation
- **QUICKSTART.md** - Get started in 5 minutes
- **MLFLOW_GUIDE.md** - MLflow integration guide
- **DATASETS_GUIDE.md** - Using the datasets node
- **TROUBLESHOOTING.md** - Common errors and fixes
- **TIPS.md** - Advanced usage tips
- **EXAMPLES.md** - Example workflows

## Available Datasets

The Sklearn Datasets node includes:

**Classification:**
- Iris (150 samples, 4 features)
- Wine (178 samples, 13 features)
- Breast Cancer (569 samples, 30 features)

**Regression:**
- Diabetes (442 samples, 10 features)
- California Housing (20640 samples, 8 features)

**Synthetic:**
- Make Regression (customizable)
- Make Classification (customizable)

## Troubleshooting

### Nodes Don't Appear

1. **Check installation location:**
   ```bash
   ls -la ~/.n8n/custom/node_modules/n8n-nodes-sklearn/
   ```

2. **Clear n8n cache:**
   ```bash
   rm -rf ~/.n8n/cache
   ```

3. **Restart n8n:**
   ```bash
   pkill -f n8n && n8n start
   ```

### Python Errors

**Error: "Python script failed"**

Check Python path:
```bash
which python3
```

Use the full path in node settings, e.g., `/usr/local/bin/python3`

**Error: "No module named 'sklearn'"**

Install scikit-learn:
```bash
pip3 install scikit-learn numpy
```

### MLflow Connection Error

Make sure MLflow server is running:
```bash
mlflow server --host 127.0.0.1 --port 5000
```

Check it's accessible: http://localhost:5000

## Development

### Making Changes

1. **Edit TypeScript files** in `nodes/`
2. **Rebuild:**
   ```bash
   npm run build
   ```
3. **Copy to n8n:**
   ```bash
   cp -r /Users/arturovaine/Documents/n8n-nodes-sklearn ~/.n8n/custom/node_modules/
   ```
4. **Restart n8n**

### Watch Mode

For active development:
```bash
npm run dev
```

## Next Steps

1. ✅ Install Python packages (sklearn, numpy, mlflow)
2. ✅ Restart n8n
3. ✅ Test basic workflow
4. ✅ Try MLflow integration
5. 📚 Read the guides in the docs folder
6. 🚀 Build your ML workflows!

## Getting Help

- Check **TROUBLESHOOTING.md** for common issues
- Review **EXAMPLES.md** for workflow patterns
- Read **TIPS.md** for advanced usage
- Open issues on GitHub (if you publish the package)

## Publishing (Optional)

To publish to npm:

1. Update package.json with your details
2. Create GitHub repository
3. Run `npm publish`

Then others can install with:
```bash
npm install n8n-nodes-sklearn
```

---

**You're all set! 🎉**

The nodes are installed and ready to use. Restart n8n and start building ML workflows!

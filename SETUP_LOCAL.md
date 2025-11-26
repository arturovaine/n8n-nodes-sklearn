# Local Setup Guide for n8n-nodes-sklearn

This guide will help you install and test the scikit-learn nodes in your local n8n instance.

## Prerequisites

- Node.js v22 or higher
- Python 3.7+ with scikit-learn and numpy installed
- n8n installed (locally or via npm/docker)

## Installation Methods

### Method 1: Using npm link (Recommended for Development)

This method creates a symlink so changes to the nodes are immediately available.

1. **Build the package** (if you haven't already):
   ```bash
   cd /Users/arturovaine/Documents/n8n-nodes-sklearn
   npm install
   npm run build
   ```

2. **Create a global npm link**:
   ```bash
   npm link
   ```

3. **Link to your n8n custom nodes directory**:

   If using n8n installed globally:
   ```bash
   mkdir -p ~/.n8n/custom
   cd ~/.n8n/custom
   npm link n8n-nodes-sklearn
   ```

   If using n8n from a specific directory:
   ```bash
   cd /path/to/your/n8n/installation
   mkdir -p custom
   cd custom
   npm link n8n-nodes-sklearn
   ```

4. **Restart n8n**:
   ```bash
   n8n start
   ```

### Method 2: Direct Copy (Simple but requires rebuild)

1. **Build the package**:
   ```bash
   cd /Users/arturovaine/Documents/n8n-nodes-sklearn
   npm install
   npm run build
   ```

2. **Copy to n8n custom directory**:
   ```bash
   mkdir -p ~/.n8n/custom/node_modules
   cp -r /Users/arturovaine/Documents/n8n-nodes-sklearn ~/.n8n/custom/node_modules/
   ```

3. **Restart n8n**

### Method 3: Using n8n Custom Extension (Docker)

If you're running n8n in Docker:

1. **Build the package**:
   ```bash
   cd /Users/arturovaine/Documents/n8n-nodes-sklearn
   npm install
   npm run build
   ```

2. **Mount the volume**:
   ```bash
   docker run -it --rm \
     --name n8n \
     -p 5678:5678 \
     -v ~/.n8n:/home/node/.n8n \
     -v /Users/arturovaine/Documents/n8n-nodes-sklearn:/home/node/.n8n/custom/node_modules/n8n-nodes-sklearn \
     n8nio/n8n
   ```

## Verifying Installation

1. **Start n8n**:
   ```bash
   n8n start
   ```

2. **Open n8n** in your browser (usually http://localhost:5678)

3. **Create a new workflow**

4. **Look for the nodes**:
   - Search for "Sklearn Linear Regression"
   - Search for "Sklearn Standard Scaler"

5. If the nodes appear, installation was successful!

## Testing the Nodes

### Quick Test Workflow

1. **Create a new workflow** in n8n

2. **Add a Code node** (or Function node) to generate test data:
   ```javascript
   return [
     {json: {x1: 1, x2: 2, y: 5}},
     {json: {x1: 2, x2: 3, y: 8}},
     {json: {x1: 3, x2: 4, y: 11}},
     {json: {x1: 4, x2: 5, y: 14}},
     {json: {x1: 5, x2: 6, y: 17}}
   ];
   ```

3. **Add an Sklearn Linear Regression node**:
   - Operation: Train
   - Feature Columns: `x1,x2`
   - Target Column: `y`
   - Python Path: `python3` (or your Python path)

4. **Execute the workflow**

5. **Check the output** - you should see:
   - Coefficients (approximately [1.5, 1.5])
   - Intercept (approximately 0.5)
   - R² score (should be 1.0 for perfect fit)

### Testing StandardScaler

1. **Add a Code node** with test data:
   ```javascript
   return [
     {json: {age: 25, income: 50000}},
     {json: {age: 35, income: 75000}},
     {json: {age: 45, income: 95000}}
   ];
   ```

2. **Add an Sklearn Standard Scaler node**:
   - Operation: Fit Transform
   - Feature Columns: `age,income`
   - With Mean: true
   - With Std: true
   - Output Prefix: `scaled_`

3. **Execute and verify** the output contains scaled versions of the features

## Troubleshooting

### Nodes Don't Appear in n8n

**Check n8n logs for errors**:
```bash
n8n start --verbose
```

**Verify the package is in the correct location**:
```bash
ls -la ~/.n8n/custom/node_modules/
```

**Check package.json has correct n8n config**:
```bash
cat /Users/arturovaine/Documents/n8n-nodes-sklearn/package.json | grep -A 5 '"n8n"'
```

**Try clearing n8n cache**:
```bash
rm -rf ~/.n8n/cache
```

### Python Script Failed Error

**Check Python is accessible**:
```bash
which python3
python3 --version
```

**Verify scikit-learn is installed**:
```bash
python3 -c "import sklearn; print(sklearn.__version__)"
```

**Use absolute Python path in nodes**:
Find your Python path:
```bash
which python3
```
Then use that full path in the "Python Path" field in the node (e.g., `/usr/local/bin/python3`)

### Module Not Found Errors

**Rebuild the package**:
```bash
cd /Users/arturovaine/Documents/n8n-nodes-sklearn
npm run build
```

**Reinstall dependencies**:
```bash
rm -rf node_modules
npm install
npm run build
```

### Permission Errors

**Fix permissions** on custom directory:
```bash
chmod -R 755 ~/.n8n/custom
```

## Development Workflow

If you're actively developing these nodes:

1. **Enable watch mode**:
   ```bash
   cd /Users/arturovaine/Documents/n8n-nodes-sklearn
   npm run dev
   ```

2. **In another terminal, run n8n**:
   ```bash
   n8n start
   ```

3. **Make changes** to the TypeScript files

4. **Restart n8n** to see changes

## Uninstallation

### If installed via npm link:
```bash
cd ~/.n8n/custom
npm unlink n8n-nodes-sklearn

cd /Users/arturovaine/Documents/n8n-nodes-sklearn
npm unlink
```

### If installed via direct copy:
```bash
rm -rf ~/.n8n/custom/node_modules/n8n-nodes-sklearn
```

## Next Steps

Once the nodes are working:

1. Try the example workflows in `EXAMPLES.md`
2. Experiment with your own datasets
3. Consider adding more scikit-learn algorithms (see `README.md` roadmap)
4. Share your workflows with the community!

## Getting Help

If you encounter issues:

1. Check the n8n logs for detailed error messages
2. Run the test script: `python3 test_sklearn.py`
3. Review the troubleshooting section above
4. Check n8n documentation: https://docs.n8n.io/integrations/creating-nodes/

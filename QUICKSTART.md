# Quick Start Guide

Get your n8n scikit-learn nodes up and running in 5 minutes!

## Status

✅ **Python & scikit-learn**: Installed and tested (v1.7.2)
✅ **Package Built**: Successfully compiled to `/dist`
✅ **Ready to Install**: All files are in place

## Installation (Choose One Method)

### Option A: npm link (Recommended)

```bash
# Step 1: Create global link
cd /Users/arturovaine/Documents/n8n-nodes-sklearn
npm link

# Step 2: Link to n8n
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm link n8n-nodes-sklearn

# Step 3: Start n8n
n8n start
```

### Option B: Direct Install

```bash
# Copy package to n8n
mkdir -p ~/.n8n/custom/node_modules
cp -r /Users/arturovaine/Documents/n8n-nodes-sklearn ~/.n8n/custom/node_modules/

# Start n8n
n8n start
```

## Quick Test

1. **Open n8n** (http://localhost:5678)

2. **Create New Workflow**

3. **Add Code Node**:
   ```javascript
   return [
     {json: {hours: 1, score: 10}},
     {json: {hours: 2, score: 20}},
     {json: {hours: 3, score: 30}},
     {json: {hours: 4, score: 40}},
     {json: {hours: 5, score: 50}}
   ];
   ```

4. **Add "Sklearn Linear Regression" Node**:
   - Operation: `Train`
   - Feature Columns: `hours`
   - Target Column: `score`

5. **Execute Workflow**

6. **Expected Output**:
   ```json
   {
     "coefficients": [10.0],
     "intercept": 0.0,
     "r2_score": 1.0,
     "training_samples": 5
   }
   ```

## Available Nodes

### 1. Sklearn Linear Regression
Train linear regression models and make predictions.

**Operations:**
- Train: Create a model from training data
- Predict: Use trained model to predict new values

### 2. Sklearn Standard Scaler
Normalize features by removing mean and scaling to unit variance.

**Operations:**
- Fit: Calculate scaling parameters
- Transform: Apply scaling to data
- Fit Transform: Do both in one step

## Project Structure

```
n8n-nodes-sklearn/
├── nodes/
│   ├── SklearnLinearRegression/
│   │   └── SklearnLinearRegression.node.ts
│   └── SklearnStandardScaler/
│       └── SklearnStandardScaler.node.ts
├── dist/                     # Compiled output (npm run build)
├── package.json              # Node package config
├── tsconfig.json             # TypeScript config
├── README.md                 # Full documentation
├── SETUP_LOCAL.md            # Detailed setup instructions
├── EXAMPLES.md               # Example workflows
├── QUICKSTART.md             # This file
└── test_sklearn.py           # Python integration tests
```

## Common Issues

### Nodes Don't Appear
- Clear cache: `rm -rf ~/.n8n/cache`
- Check n8n logs: `n8n start --verbose`
- Verify link: `ls -la ~/.n8n/custom/node_modules/`

### Python Errors
- Check Python path: `which python3`
- Verify sklearn: `python3 -c "import sklearn; print('OK')"`
- Use absolute path in node config

### Build Errors
```bash
cd /Users/arturovaine/Documents/n8n-nodes-sklearn
npm install
npm run build
```

## Next Steps

1. ✅ **You're here**: Nodes are built and ready
2. 📦 **Install**: Use npm link or copy method above
3. 🧪 **Test**: Run the quick test workflow
4. 📚 **Learn**: Check `EXAMPLES.md` for more workflows
5. 🚀 **Build**: Create your own ML workflows!

## Development

**Watch mode** (auto-rebuild on changes):
```bash
npm run dev
```

**Manual rebuild**:
```bash
npm run build
```

## Resources

- **Full Documentation**: `README.md`
- **Setup Guide**: `SETUP_LOCAL.md`
- **Examples**: `EXAMPLES.md`
- **Test Script**: `test_sklearn.py`

## Support

Having issues? Check:
1. This guide first
2. `SETUP_LOCAL.md` troubleshooting section
3. n8n docs: https://docs.n8n.io/integrations/creating-nodes/

---

**Current Location**: `/Users/arturovaine/Documents/n8n-nodes-sklearn`

**Build Status**: ✅ Ready
**Python Status**: ✅ Working (3.12.3 with scikit-learn 1.7.2)
**Next Action**: Install to n8n using one of the methods above

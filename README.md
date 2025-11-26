# n8n-nodes-sklearn

Custom n8n nodes for integrating scikit-learn machine learning algorithms into your n8n workflows.

## Features

This package provides n8n nodes for popular scikit-learn functionality:

- **Sklearn Linear Regression**: Train and predict using linear regression models
- **Sklearn Standard Scaler**: Standardize features by removing the mean and scaling to unit variance

## Installation

### Prerequisites

1. **Python 3.7+** with scikit-learn installed:
   ```bash
   pip install scikit-learn numpy
   ```

2. **n8n** installed (version 0.190.0 or higher)

### Installing the Package

#### Option 1: Install from npm (after publishing)
```bash
npm install n8n-nodes-sklearn
```

#### Option 2: Local Development Installation

1. Clone or download this repository
2. Navigate to the package directory:
   ```bash
   cd n8n-nodes-sklearn
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the package:
   ```bash
   npm run build
   ```

5. Link the package to your n8n installation:
   ```bash
   npm link
   ```

6. In your n8n custom nodes directory (usually `~/.n8n/custom`):
   ```bash
   npm link n8n-nodes-sklearn
   ```

7. Restart n8n to load the new nodes

## Usage

### Sklearn Linear Regression

#### Train Operation

Train a linear regression model using your input data.

**Input Data Format:**
```json
[
  {
    "feature1": 1.0,
    "feature2": 2.0,
    "feature3": 3.0,
    "target": 10.5
  },
  {
    "feature1": 2.0,
    "feature2": 3.0,
    "feature3": 4.0,
    "target": 15.2
  }
]
```

**Parameters:**
- **Feature Columns**: Comma-separated list of feature column names (e.g., `feature1,feature2,feature3`)
- **Target Column**: Name of the target column (e.g., `target`)
- **Fit Intercept**: Whether to calculate the intercept (default: true)
- **Python Path**: Path to Python executable (default: `python3`)

**Output:**
```json
{
  "model": "{...}",
  "coefficients": [1.2, 3.4, 2.1],
  "intercept": 0.5,
  "r2_score": 0.95,
  "feature_columns": ["feature1", "feature2", "feature3"],
  "training_samples": 100
}
```

#### Predict Operation

Make predictions using a trained model.

**Parameters:**
- **Model Data**: JSON string containing the trained model (from train operation)
- **Feature Columns**: Comma-separated list of feature columns (must match training)
- **Python Path**: Path to Python executable

**Output:**
The original input data with an added `prediction` field.

### Sklearn Standard Scaler

#### Fit Transform Operation

Fit the scaler to your data and transform it in one step.

**Input Data Format:**
```json
[
  {
    "age": 25,
    "income": 50000,
    "score": 85
  },
  {
    "age": 35,
    "income": 75000,
    "score": 92
  }
]
```

**Parameters:**
- **Feature Columns**: Comma-separated list of columns to scale (e.g., `age,income,score`)
- **With Mean**: Whether to center the data (default: true)
- **With Std**: Whether to scale to unit variance (default: true)
- **Output Prefix**: Prefix for scaled columns (default: `scaled_`)
- **Python Path**: Path to Python executable

**Output:**
Original data with scaled features added:
```json
{
  "age": 25,
  "income": 50000,
  "score": 85,
  "scaled_age": -0.707,
  "scaled_income": -0.707,
  "scaled_score": -0.707,
  "scaler": "{...}",
  "scaler_info": {
    "mean": [30, 62500, 88.5],
    "scale": [7.071, 17677.67, 4.95]
  }
}
```

#### Fit Operation

Fit the scaler and save parameters for later use.

**Output:**
```json
{
  "scaler": "{...}",
  "mean": [30, 62500, 88.5],
  "scale": [7.071, 17677.67, 4.95],
  "variance": [50, 312500000, 24.5],
  "feature_columns": ["age", "income", "score"],
  "fitted_samples": 100
}
```

#### Transform Operation

Transform data using a previously fitted scaler.

**Parameters:**
- **Scaler Data**: JSON string from fit operation
- **Feature Columns**: Comma-separated list of columns (must match fitted columns)
- **Output Prefix**: Prefix for scaled columns

## Example Workflows

### Example 1: Simple Linear Regression Pipeline

1. **Read CSV Node**: Load your training data
2. **Sklearn Linear Regression (Train)**: Train the model
3. **Set Node**: Store the model in a variable
4. **Read CSV Node**: Load new data for prediction
5. **Sklearn Linear Regression (Predict)**: Make predictions

### Example 2: Preprocessing Pipeline

1. **HTTP Request Node**: Fetch data from API
2. **Sklearn Standard Scaler (Fit Transform)**: Normalize features
3. **Sklearn Linear Regression (Train)**: Train on normalized data
4. **Code Node**: Evaluate model performance

## Configuration

### Python Path

By default, nodes use `python3` command. If you need to specify a different Python executable:

1. Set the Python Path parameter in each node
2. Or set an environment variable before starting n8n:
   ```bash
   export PYTHON_PATH=/path/to/python3
   n8n start
   ```

### Troubleshooting

**Error: Python script failed**
- Ensure Python 3.7+ is installed
- Verify scikit-learn is installed: `python3 -c "import sklearn; print(sklearn.__version__)"`
- Check Python path in node parameters

**Error: Feature column not found**
- Verify column names match your input data exactly (case-sensitive)
- Check for extra spaces in column names

**Memory issues with large datasets**
- Consider processing data in batches
- Use n8n's batch processing features
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096 n8n start`

## Development

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
npm run lintfix  # Auto-fix issues
```

### Adding New Nodes

1. Create a new directory in `nodes/`
2. Create `YourNode.node.ts` implementing `INodeType`
3. Add the node to `package.json` under `n8n.nodes`
4. Run `npm run build`

## Roadmap

Future nodes planned:

- Logistic Regression
- Decision Trees / Random Forest
- K-Means Clustering
- Principal Component Analysis (PCA)
- Support Vector Machines (SVM)
- Model evaluation metrics
- Cross-validation utilities

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT

## Support

For issues and questions:
- GitHub Issues: https://github.com/arturovaine/n8n-nodes-sklearn/issues
- n8n Community Forum: https://community.n8n.io/

## Acknowledgments

- Built on top of the excellent [n8n](https://n8n.io/) workflow automation platform
- Uses [scikit-learn](https://scikit-learn.org/) for machine learning functionality

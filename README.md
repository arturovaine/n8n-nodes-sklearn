# n8n-nodes-sklearn

Custom n8n community nodes for integrating scikit-learn machine learning algorithms into your n8n workflows.

> **Important: Self-Hosted n8n Only**
>
> This package requires Python with scikit-learn installed and uses `child_process` to execute Python scripts. It is designed for **self-hosted n8n installations only** and is not compatible with n8n Cloud.

## Available Nodes (40)

### Regression
- **Linear Regression** - Simple and multiple linear regression
- **Ridge / Lasso** - L2 and L1 regularized regression
- **Elastic Net** - Combined L1+L2 regularization
- **SVR** - Support Vector Regression
- **Decision Tree Regressor** - Tree-based regression
- **Random Forest Regressor** - Ensemble tree regression
- **Gradient Boosting Regressor** - Boosted tree regression
- **KNN Regressor** - K-Nearest Neighbors regression
- **MLP Regressor** - Neural network regression

### Classification
- **Logistic Regression** - Binary and multiclass classification
- **SVC** - Support Vector Classification
- **Decision Tree Classifier** - Tree-based classification
- **Random Forest Classifier** - Ensemble tree classification
- **Gradient Boosting Classifier** - Boosted tree classification
- **KNN Classifier** - K-Nearest Neighbors classification
- **Naive Bayes** - Gaussian, Multinomial, Bernoulli variants
- **MLP Classifier** - Neural network classification

### Clustering
- **KMeans** - Centroid-based clustering
- **DBSCAN** - Density-based clustering
- **Agglomerative Clustering** - Hierarchical clustering
- **Spectral Clustering** - Graph-based clustering
- **Mean Shift** - Mode-seeking clustering

### Anomaly Detection
- **Isolation Forest** - Outlier detection

### Preprocessing
- **Standard Scaler** - Zero mean, unit variance scaling
- **MinMax Scaler** - Scale to [0,1] range
- **Robust Scaler** - Outlier-robust scaling (median/IQR)
- **Normalizer** - Row-wise L1/L2 normalization
- **Binarizer** - Threshold-based binarization
- **Label Encoder** - Encode categorical labels
- **One Hot Encoder** - One-hot encode categories
- **Simple Imputer** - Handle missing values

### Feature Engineering
- **PCA** - Principal Component Analysis
- **Truncated SVD** - Dimensionality reduction for sparse data
- **NMF** - Non-negative Matrix Factorization
- **Polynomial Features** - Generate polynomial features
- **TF-IDF Vectorizer** - Text to TF-IDF features
- **Feature Selection** - SelectKBest, RFE, Variance Threshold

### Ensemble Methods
- **Voting Classifier** - Combine multiple classifiers
- **Stacking Classifier** - Stacked generalization

### Calibration
- **Calibrated Classifier CV** - Probability calibration

### Utilities
- **Train Test Split** - Split data for training/testing
- **Metrics** - Classification, regression, clustering metrics
- **Cross Validation** - K-Fold, Stratified, LOO, Shuffle Split
- **Grid Search CV** - Hyperparameter tuning
- **Pipeline** - Chain transformers and estimators
- **Datasets** - Load sample sklearn datasets

## Requirements

### Self-Hosted n8n
- n8n version 0.190.0 or higher
- Python 3.7+ installed on the server
- scikit-learn and numpy Python packages

```bash
pip install scikit-learn numpy
```

### Why Self-Hosted Only?

This package executes Python code via `child_process.spawn()` to run scikit-learn algorithms. This approach:
- Requires Python runtime on the host system
- Uses Node.js `child_process` module (restricted on n8n Cloud)
- Cannot pass n8n's community node verification for Cloud deployment

There is no pure JavaScript implementation of scikit-learn, making this architecture necessary.

## Installation

### Option 1: Install from npm

```bash
cd ~/.n8n/custom
npm install n8n-nodes-sklearn
```

Then restart n8n.

### Option 2: Install via n8n UI

1. Go to **Settings** > **Community Nodes**
2. Enter `n8n-nodes-sklearn`
3. Click **Install**
4. Restart n8n

### Option 3: Docker

If using Docker, ensure Python and scikit-learn are installed in your container:

```dockerfile
FROM n8nio/n8n:latest

USER root
RUN apk add --no-cache python3 py3-pip
RUN pip3 install scikit-learn numpy
USER node

RUN cd /home/node/.n8n/custom && npm install n8n-nodes-sklearn
```

## Usage

### Basic Workflow Example

1. **Load Data** - Use HTTP Request, Read CSV, or other data source
2. **Preprocess** - Scale features with Standard Scaler
3. **Train** - Train a model (e.g., Random Forest Classifier)
4. **Predict** - Use the trained model on new data
5. **Evaluate** - Calculate metrics

### Train a Model

```
Input Data:
[
  { "feature1": 1.0, "feature2": 2.0, "target": 0 },
  { "feature1": 2.0, "feature2": 3.0, "target": 1 },
  ...
]

Parameters:
- Feature Columns: feature1,feature2
- Target Column: target
- Python Path: python3

Output:
{
  "model": "{...serialized model...}",
  "score": 0.95,
  "classes": [0, 1],
  ...
}
```

### Make Predictions

```
Parameters:
- Model Data: {{ $json.model }}
- Feature Columns: feature1,feature2

Output:
{
  "feature1": 1.5,
  "feature2": 2.5,
  "prediction": 1,
  "probabilities": [0.2, 0.8]
}
```

### Python Path Configuration

By default, nodes use `python3`. To specify a different Python:

1. Set the **Python Path** parameter in each node, or
2. Set environment variable before starting n8n:
   ```bash
   export PYTHON_PATH=/usr/local/bin/python3.10
   n8n start
   ```

## Troubleshooting

### Python script failed
- Verify Python 3.7+ is installed: `python3 --version`
- Verify scikit-learn is installed: `python3 -c "import sklearn; print(sklearn.__version__)"`
- Check the Python Path parameter matches your installation

### Feature column not found
- Column names are case-sensitive
- Check for extra spaces in column names
- Verify the column exists in your input data

### Memory issues
- Process data in smaller batches
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 n8n start`

### Model serialization issues
- Models are serialized using Python's pickle + base64
- Ensure the same Python/sklearn version for train and predict

## Development

```bash
# Clone the repository
git clone https://github.com/arturovaine/n8n-nodes-sklearn.git
cd n8n-nodes-sklearn

# Install dependencies
npm install

# Build
npm run build

# Lint
npm run lint

# Link for local development
npm link
cd ~/.n8n/custom
npm link n8n-nodes-sklearn
```

## License

MIT

## Support

- **GitHub Issues**: https://github.com/arturovaine/n8n-nodes-sklearn/issues
- **n8n Community Forum**: https://community.n8n.io/

## Acknowledgments

- [n8n](https://n8n.io/) - Workflow automation platform
- [scikit-learn](https://scikit-learn.org/) - Machine learning library for Python

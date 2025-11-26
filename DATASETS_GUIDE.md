# Sklearn Datasets Node Guide

The **Sklearn Datasets** node provides easy access to scikit-learn's built-in datasets and synthetic data generators. Perfect for testing and learning!

## Available Datasets

### Real Datasets

#### 1. Iris 🌸
- **Type**: Classification
- **Samples**: 150
- **Features**: 4 (sepal length, sepal width, petal length, petal width)
- **Target**: 3 flower species
- **Use case**: Multi-class classification

#### 2. Wine 🍷
- **Type**: Classification
- **Samples**: 178
- **Features**: 13 (chemical analysis)
- **Target**: 3 wine types
- **Use case**: Multi-class classification

#### 3. Breast Cancer 🎗️
- **Type**: Classification
- **Samples**: 569
- **Features**: 30 (cell measurements)
- **Target**: 2 classes (malignant/benign)
- **Use case**: Binary classification

#### 4. Diabetes 💉
- **Type**: Regression
- **Samples**: 442
- **Features**: 10 (age, BMI, blood pressure, etc.)
- **Target**: Disease progression (numeric)
- **Use case**: Regression

#### 5. Boston Housing 🏠
- **Type**: Regression
- **Samples**: 506
- **Features**: 13 (crime rate, rooms, age, etc.)
- **Target**: House prices
- **Use case**: Regression
- **Note**: Falls back to California Housing in newer sklearn versions

### Synthetic Datasets

#### 6. Make Regression
- **Type**: Regression
- **Customizable**: samples, features, random state
- **Use case**: Testing regression algorithms

#### 7. Make Classification
- **Type**: Classification
- **Customizable**: samples, features, random state
- **Use case**: Testing classification algorithms

## Quick Start Examples

### Example 1: Train with Iris Dataset

**Workflow:**
1. **Sklearn Datasets** node
   - Dataset: `Iris`
   - Output Format: `Rows`
   - Include Target: ✓

2. **Sklearn Standard Scaler** node
   - Operation: `Fit Transform`
   - Feature Columns: `sepal length (cm),sepal width (cm),petal length (cm),petal width (cm)`

3. **Sklearn Linear Regression** node
   - Operation: `Train`
   - Feature Columns: `scaled_sepal length (cm),scaled_sepal width (cm),scaled_petal length (cm),scaled_petal width (cm)`
   - Target Column: `target_numeric`

### Example 2: Simple Regression Test

**Workflow:**
1. **Sklearn Datasets** node
   - Dataset: `Make Regression`
   - Number of Samples: `100`
   - Number of Features: `3`
   - Random State: `42`
   - Output Format: `Rows`

2. **Sklearn Linear Regression** node
   - Operation: `Train`
   - Feature Columns: `feature_0,feature_1,feature_2`
   - Target Column: `target_numeric`

Expected R² score: ~0.9-1.0 (synthetic data is designed to have clear relationships)

### Example 3: Compare Scaled vs Unscaled

**Workflow:**
1. **Sklearn Datasets** node
   - Dataset: `Diabetes`
   - Output Format: `Rows`

2. **Split in Batches** node (to create two paths)

3. **Path A - Without Scaling:**
   - Sklearn Linear Regression (train with original features)

4. **Path B - With Scaling:**
   - Sklearn Standard Scaler (fit transform)
   - Sklearn Linear Regression (train with scaled features)

Compare the R² scores!

## Output Formats

### Rows Format (Recommended)

Each sample becomes a separate n8n item:

```json
[
  {
    "sepal length (cm)": 5.1,
    "sepal width (cm)": 3.5,
    "petal length (cm)": 1.4,
    "petal width (cm)": 0.2,
    "target": "setosa",
    "target_numeric": 0
  },
  {
    "sepal length (cm)": 4.9,
    "sepal width (cm)": 3.0,
    "petal length (cm)": 1.4,
    "petal width (cm)": 0.2,
    "target": "setosa",
    "target_numeric": 0
  }
  // ... 148 more items
]
```

**Best for:**
- Direct use with other n8n nodes
- Feeding into Linear Regression or Standard Scaler
- Row-by-row processing

### Arrays Format

All data in single item:

```json
{
  "features": [
    [5.1, 3.5, 1.4, 0.2],
    [4.9, 3.0, 1.4, 0.2],
    // ...
  ],
  "target": [0, 0, 1, 1, 2, 2, ...],
  "feature_names": ["sepal length (cm)", "sepal width (cm)", ...],
  "target_name": ["setosa", "versicolor", "virginica"],
  "n_samples": 150,
  "n_features": 4,
  "description": "Iris dataset description..."
}
```

**Best for:**
- Batch processing
- Custom Python scripts
- Data analysis

## Common Patterns

### Pattern 1: Train/Test Split

```javascript
// In a Code node after Sklearn Datasets
const trainSize = Math.floor(items.length * 0.8);
const trainData = items.slice(0, trainSize);
const testData = items.slice(trainSize);

// Return train data (send test data to another branch)
return trainData;
```

### Pattern 2: Feature Selection

Use only specific features:

```javascript
// In a Code node
return items.map(item => ({
  json: {
    feature_0: item.json.feature_0,
    feature_2: item.json.feature_2,
    target_numeric: item.json.target_numeric
  }
}));
```

### Pattern 3: Custom Synthetic Data

**Sklearn Datasets** node:
- Dataset: `Make Regression`
- Number of Samples: `1000`
- Number of Features: `5`
- Random State: `42` (for reproducibility)

## Troubleshooting

### Boston Dataset Warning

If you see warnings about Boston dataset, don't worry! The node automatically falls back to California Housing dataset, which is similar and works the same way.

### Feature Names

For synthetic datasets, features are named:
- `feature_0`, `feature_1`, `feature_2`, etc.

For real datasets, features have descriptive names:
- Iris: `sepal length (cm)`, `sepal width (cm)`, etc.
- Diabetes: `age`, `sex`, `bmi`, `bp`, etc.

### Target Column

The node provides two target columns:
- `target`: Human-readable (e.g., "setosa" for Iris)
- `target_numeric`: Numeric value (e.g., 0, 1, 2)

**Always use `target_numeric` for Linear Regression!**

## Best Practices

1. **Start small**: Use Iris or Make Regression with 100 samples for testing
2. **Use random state**: Set consistent random state for reproducible results
3. **Check your data**: Add a Table node after Sklearn Datasets to inspect the data
4. **Scale when needed**: Use Standard Scaler for datasets with different feature scales (like Diabetes)
5. **Use Rows format**: It's more n8n-friendly for most workflows

## Complete Workflow Example

Here's a complete working example:

1. **Manual Trigger** (start workflow)

2. **Sklearn Datasets**
   - Dataset: `Diabetes`
   - Output Format: `Rows`
   - Include Target: ✓

3. **Sklearn Standard Scaler**
   - Operation: `Fit Transform`
   - Feature Columns: `age,sex,bmi,bp,s1,s2,s3,s4,s5,s6`
   - Output Prefix: `scaled_`

4. **Sklearn Linear Regression**
   - Operation: `Train`
   - Feature Columns: `scaled_age,scaled_sex,scaled_bmi,scaled_bp,scaled_s1,scaled_s2,scaled_s3,scaled_s4,scaled_s5,scaled_s6`
   - Target Column: `target_numeric`

5. **Table** node (view results)
   - Check the R² score
   - View coefficients

Expected R² score: ~0.51 (diabetes is a challenging dataset!)

## Next Steps

- Try different datasets
- Experiment with feature selection
- Compare different preprocessing techniques
- Build train/test splits
- Create prediction workflows

Happy machine learning! 🚀

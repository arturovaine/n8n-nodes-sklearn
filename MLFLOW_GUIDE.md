# MLflow Integration Guide

Track your machine learning experiments with MLflow directly from n8n workflows!

## Prerequisites

### 1. Install MLflow

```bash
pip3 install mlflow
```

### 2. Start MLflow Tracking Server

```bash
mlflow server --host 127.0.0.1 --port 5000
```

Or run in background:
```bash
mlflow server --host 127.0.0.1 --port 5000 &
```

### 3. Access MLflow UI

Open http://localhost:5000 in your browser to view experiments.

## Quick Start Example

### Workflow: Track a Linear Regression Experiment

1. **Sklearn Datasets** node
   - Dataset: `Diabetes`
   - Output Format: `Rows`

2. **Sklearn MLflow - Start Run** node
   - Experiment Name: `diabetes-regression`
   - Run Name: `run-001`
   - Tracking URI: `http://localhost:5000`

3. **Sklearn MLflow - Log Parameters** node
   - Parameters: `fit_intercept`
   - (Add any hyperparameters from your config)

4. **Sklearn Linear Regression - Train** node
   - Feature Columns: `age,sex,bmi,bp,s1,s2,s3,s4,s5,s6`
   - Target Column: `target_numeric`

5. **Sklearn MLflow - Log Metrics** node
   - Metrics: `r2_score,training_samples`

6. **Sklearn MLflow - Log Model** node
   - Model Type: `Linear Regression`
   - Model Data Field: `model`
   - Model Name: `diabetes-lr-model`

7. **Sklearn MLflow - End Run** node

## MLflow Node Operations

### Start Run

Begins a new experiment run. Creates an experiment if it doesn't exist.

**Parameters:**
- **Experiment Name**: Name of the experiment (e.g., `my-ml-project`)
- **Run Name**: Optional name for this specific run
- **Tracking URI**: MLflow server URL (default: `http://localhost:5000`)

**Output:**
```json
{
  "mlflow_result": {
    "run_id": "abc123...",
    "experiment_id": "1",
    "run_name": "run-001",
    "artifact_uri": "file:///path/to/mlruns/1/abc123/artifacts",
    "status": "RUNNING"
  }
}
```

### Log Metrics

Logs performance metrics to the current run.

**Parameters:**
- **Metrics**: Comma-separated list of metric names from input data
  - Example: `r2_score,mse,mae`

**Input Data Example:**
```json
{
  "r2_score": 0.95,
  "mse": 0.05,
  "mae": 0.03
}
```

### Log Parameters

Records hyperparameters for the run.

**Parameters:**
- **Parameters**: Comma-separated list of parameter names from input data
  - Example: `learning_rate,max_depth,n_estimators`

**Input Data Example:**
```json
{
  "learning_rate": 0.01,
  "max_depth": 10,
  "n_estimators": 100
}
```

### Log Model

Saves a scikit-learn model to MLflow.

**Parameters:**
- **Model Type**: Type of sklearn model (Linear Regression, etc.)
- **Model Data Field**: Field containing model JSON (usually `model`)
- **Model Name**: Name to save model as

**Input Data Example:**
```json
{
  "model": "{\"coefficients\": [1.2, 3.4], \"intercept\": 0.5}",
  "r2_score": 0.95
}
```

### End Run

Finalizes the current experiment run.

## Complete Example Workflow

```
┌─────────────────┐
│ Manual Trigger  │
└────────┬────────┘
         │
┌────────▼──────────┐
│ Sklearn Datasets  │
│ (Diabetes)        │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ MLflow Start Run  │
│ Exp: diabetes-exp │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ Code Node         │
│ (Set params)      │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ MLflow Log Params │
│ fit_intercept     │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ Linear Regression │
│ (Train)           │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ MLflow Log        │
│ Metrics           │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ MLflow Log Model  │
└────────┬──────────┘
         │
┌────────▼──────────┐
│ MLflow End Run    │
└───────────────────┘
```

## Viewing Results

1. Open MLflow UI: http://localhost:5000
2. Click on your experiment name
3. View all runs, metrics, and parameters
4. Compare different runs
5. Download logged models

## Advanced Usage

### Multiple Experiments

Track different types of models in separate experiments:

```javascript
// Code node before Start Run
return [{
  json: {
    experiment_name: 'linear-models',  // or 'tree-models', 'ensemble-models'
    run_name: `lr-${Date.now()}`
  }
}];
```

Then use expressions in Start Run:
- Experiment Name: `{{ $json.experiment_name }}`
- Run Name: `{{ $json.run_name }}`

### Custom Metrics

Log any metric from your workflow:

```javascript
// Code node to calculate custom metrics
const predictions = items.map(i => i.json.prediction);
const actuals = items.map(i => i.json.target_numeric);

// Calculate custom metrics
const mse = predictions.reduce((sum, pred, i) =>
  sum + Math.pow(pred - actuals[i], 2), 0) / predictions.length;

const mae = predictions.reduce((sum, pred, i) =>
  sum + Math.abs(pred - actuals[i]), 0) / predictions.length;

return [{
  json: {
    mse,
    mae,
    rmse: Math.sqrt(mse)
  }
}];
```

Then log with MLflow: `mse,mae,rmse`

### Comparing Runs

Run multiple experiments with different hyperparameters:

```javascript
// Code node to generate parameter combinations
const params = [
  { fit_intercept: true, normalize: false },
  { fit_intercept: true, normalize: true },
  { fit_intercept: false, normalize: false },
  { fit_intercept: false, normalize: true }
];

return params.map(p => ({ json: p }));
```

Then loop through each parameter set, training and logging to MLflow.

## Troubleshooting

### Connection Error

```
Error: Python script failed: ConnectionRefusedError
```

**Solution**: Make sure MLflow server is running:
```bash
mlflow server --host 127.0.0.1 --port 5000
```

### MLflow Not Installed

```
Error: No module named 'mlflow'
```

**Solution**: Install MLflow in your Python environment:
```bash
pip3 install mlflow
```

### Wrong Tracking URI

If you're running MLflow on a different port or remote server:

Update the **Tracking URI** in each MLflow node:
- Local: `http://localhost:5000`
- Custom port: `http://localhost:8080`
- Remote: `http://your-server:5000`

### Model Logging Fails

Make sure your model data is in the correct format:
- Must have `coefficients` array
- Must have `intercept` value
- Both from Sklearn Linear Regression node output

## Best Practices

1. **Use Descriptive Names**
   - Experiment: `project-name-model-type`
   - Run: `feature-set-v1`, `hyperparams-v2`

2. **Log Everything**
   - All hyperparameters
   - All metrics (train and validation)
   - Model artifacts
   - Dataset info

3. **Organize Experiments**
   - One experiment per model type
   - Or one experiment per problem/dataset
   - Keep runs comparable

4. **Add Tags** (via Code node + custom Python)
   ```python
   mlflow.set_tag("developer", "your-name")
   mlflow.set_tag("version", "v1.0")
   ```

5. **Track Dataset Version**
   ```javascript
   // Log dataset metadata
   return [{
     json: {
       dataset_version: "2024-01-15",
       n_samples: items.length,
       n_features: 10
     }
   }];
   ```

## Next Steps

- Experiment with different models
- Compare hyperparameter combinations
- Use MLflow Model Registry for production deployment
- Set up remote MLflow server for team collaboration

## Resources

- MLflow Documentation: https://mlflow.org/docs/latest/index.html
- MLflow Python API: https://mlflow.org/docs/latest/python_api/index.html
- MLflow Tracking: https://mlflow.org/docs/latest/tracking.html

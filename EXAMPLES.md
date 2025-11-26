# Example Workflows

## Example 1: Basic Linear Regression

This example demonstrates training a linear regression model and making predictions.

### Sample Data (training.json)
```json
[
  {"hours_studied": 1, "previous_score": 50, "final_score": 55},
  {"hours_studied": 2, "previous_score": 60, "final_score": 65},
  {"hours_studied": 3, "previous_score": 70, "final_score": 75},
  {"hours_studied": 4, "previous_score": 80, "final_score": 85},
  {"hours_studied": 5, "previous_score": 90, "final_score": 95}
]
```

### Workflow Steps

1. **Load Training Data** (Read/Fetch Data node)
2. **Train Model** (Sklearn Linear Regression node)
   - Operation: Train
   - Feature Columns: `hours_studied,previous_score`
   - Target Column: `final_score`
   - Fit Intercept: true

3. **Store Model** (Set node)
   - Save the `model` field to a variable

4. **Load New Data** (Read/Fetch Data node)
   ```json
   [{"hours_studied": 3.5, "previous_score": 75}]
   ```

5. **Make Predictions** (Sklearn Linear Regression node)
   - Operation: Predict
   - Model Data: `{{$node["Train Model"].json["model"]}}`
   - Feature Columns: `hours_studied,previous_score`

### Expected Output
```json
{
  "hours_studied": 3.5,
  "previous_score": 75,
  "prediction": 80.5
}
```

## Example 2: Feature Scaling Pipeline

This example shows how to normalize features before training.

### Sample Data
```json
[
  {"age": 25, "income": 50000, "credit_score": 650, "approved": 1},
  {"age": 35, "income": 75000, "credit_score": 720, "approved": 1},
  {"age": 45, "income": 95000, "credit_score": 800, "approved": 1},
  {"age": 22, "income": 30000, "credit_score": 580, "approved": 0},
  {"age": 28, "income": 40000, "credit_score": 600, "approved": 0}
]
```

### Workflow Steps

1. **Load Data** (Read/Fetch Data node)

2. **Scale Features** (Sklearn Standard Scaler node)
   - Operation: Fit Transform
   - Feature Columns: `age,income,credit_score`
   - With Mean: true
   - With Std: true
   - Output Prefix: `scaled_`

3. **Train Model** (Sklearn Linear Regression node)
   - Operation: Train
   - Feature Columns: `scaled_age,scaled_income,scaled_credit_score`
   - Target Column: `approved`

4. **Make Predictions on New Data**
   - First scale new data using the saved scaler
   - Then predict using the trained model

## Example 3: Testing Python Integration

Simple test to verify Python and scikit-learn are working.

### Test Data
```json
[
  {"x": 1, "y": 2},
  {"x": 2, "y": 4},
  {"x": 3, "y": 6},
  {"x": 4, "y": 8},
  {"x": 5, "y": 10}
]
```

### Expected Results
- R² score should be 1.0 (perfect fit)
- Coefficient should be approximately 2.0
- Intercept should be approximately 0.0

## Testing the Installation

### Quick Test Script

Create a test workflow in n8n:

1. **Manual Trigger** node

2. **Function** node to generate test data:
```javascript
return [
  {json: {x1: 1, x2: 2, y: 5}},
  {json: {x1: 2, x2: 3, y: 8}},
  {json: {x1: 3, x2: 4, y: 11}},
  {json: {x1: 4, x2: 5, y: 14}},
  {json: {x1: 5, x2: 6, y: 17}}
];
```

3. **Sklearn Linear Regression** node:
   - Operation: Train
   - Feature Columns: `x1,x2`
   - Target Column: `y`

4. **If** node to check if R² score > 0.99

### Troubleshooting Tests

If the test fails:

1. Check Python is accessible:
```bash
python3 --version
```

2. Check scikit-learn is installed:
```bash
python3 -c "import sklearn; print(sklearn.__version__)"
```

3. Test with absolute Python path in node configuration:
```bash
which python3
```

4. Check n8n logs for detailed error messages

# Tips & Tricks for n8n-nodes-sklearn

## Using Parent Connection Data

### Quick Method: Copy Column Names

1. **View parent node output** (click on the node to see data)
2. **Note the column names** from the JSON
3. **Paste into Feature Columns** field

Example from Sklearn Datasets (Diabetes):
```
age,sex,bmi,bp,s1,s2,s3,s4,s5,s6
```

### Advanced: Use Expressions

Click the expression icon (fx) in the Feature Columns field and use:

**Get all numeric columns automatically:**
```javascript
{{ Object.keys($input.first().json).filter(k => typeof $input.first().json[k] === 'number' && k !== 'target_numeric').join(',') }}
```

**Get specific columns:**
```javascript
{{ ['age', 'bmi', 'bp'].join(',') }}
```

**Exclude certain columns:**
```javascript
{{ Object.keys($input.first().json).filter(k => !['id', 'name', 'target_numeric'].includes(k)).join(',') }}
```

## Workflow Patterns

### Pattern 1: Dataset → Train → Predict

```
[Sklearn Datasets]
    ↓
[Sklearn Linear Regression - Train]
    ↓
[Sklearn Linear Regression - Predict]
```

**Setup:**
1. Datasets outputs `feature_0, feature_1, ..., target_numeric`
2. Train uses: `feature_0,feature_1` → `target_numeric`
3. Predict uses the model from step 2

### Pattern 2: External Data → Scale → Train

```
[HTTP Request / CSV / Database]
    ↓
[Code Node - Clean Data]
    ↓
[Sklearn Standard Scaler]
    ↓
[Sklearn Linear Regression]
```

**Code Node Example - Extract numeric columns:**
```javascript
return items.map(item => {
  // Convert dates to timestamps
  const created = new Date(item.json.created).getTime();

  // Extract numeric fields
  return {
    json: {
      age: item.json.age,
      value: item.json.value,
      created_timestamp: created,
      target: item.json.revenue
    }
  };
});
```

### Pattern 3: Train/Test Split

```
[Sklearn Datasets]
    ↓
[Code Node - Split Data 80/20]
    ↓         ↓
  [Train]  [Test]
    ↓         ↓
  [Merge] → [Evaluate]
```

**Split Code:**
```javascript
const splitIndex = Math.floor(items.length * 0.8);
const trainData = items.slice(0, splitIndex);
const testData = items.slice(splitIndex);

// Return train data
// (route test data through different connection)
return trainData;
```

## Common Column Selection Scenarios

### Scenario 1: Sklearn Datasets Node
Columns are clearly named in the output. Just look at the data and copy names.

**Diabetes:**
- Features: `age,sex,bmi,bp,s1,s2,s3,s4,s5,s6`
- Target: `target_numeric`

**Iris:**
- Features: `sepal length (cm),sepal width (cm),petal length (cm),petal width (cm)`
- Target: `target_numeric`

### Scenario 2: After Standard Scaler
If you use `scaled_` prefix, your columns become:
- Original: `age,bmi,bp`
- Scaled: `scaled_age,scaled_bmi,scaled_bp`

Use the scaled versions for training!

### Scenario 3: Custom Data with Mixed Types

Add a **Code Node** to filter numeric columns:

```javascript
// Get first item to inspect structure
const sampleItem = items[0].json;

// Find numeric columns
const numericColumns = Object.keys(sampleItem).filter(key => {
  const value = sampleItem[key];
  return typeof value === 'number' && !isNaN(value);
});

console.log('Numeric columns:', numericColumns.join(','));

// Pass through data unchanged
return items;
```

Then check the n8n logs to see which columns are numeric!

## Debugging Tips

### Tip 1: Check Column Names
Add a **Code Node** before the regression node:

```javascript
// Log available columns
const columns = Object.keys(items[0].json);
console.log('Available columns:', columns);

// Check for numeric columns
const numericCols = columns.filter(col =>
  typeof items[0].json[col] === 'number'
);
console.log('Numeric columns:', numericCols);

// Check for NaN values
columns.forEach(col => {
  const hasNaN = items.some(item =>
    isNaN(parseFloat(item.json[col]))
  );
  if (hasNaN) console.log(`Column '${col}' has NaN values`);
});

return items;
```

### Tip 2: Inspect Data Types
Add this before training:

```javascript
const first = items[0].json;

Object.keys(first).forEach(key => {
  const value = first[key];
  const type = typeof value;
  const parsed = parseFloat(value);

  console.log(`${key}: ${type} = ${value} → ${parsed}`);
});

return items;
```

### Tip 3: Handle Missing Values

```javascript
return items.map(item => {
  const cleaned = {};

  Object.keys(item.json).forEach(key => {
    let value = item.json[key];

    // Replace null/undefined with 0
    if (value === null || value === undefined) {
      value = 0;
    }

    cleaned[key] = value;
  });

  return { json: cleaned };
});
```

## Feature Engineering Tips

### Create Interaction Features

```javascript
return items.map(item => ({
  json: {
    ...item.json,
    age_bmi: item.json.age * item.json.bmi,
    bp_squared: item.json.bp ** 2,
  }
}));
```

### Normalize Before Training

Always use **Sklearn Standard Scaler** for features with different scales:
- Age: 20-80
- Income: 20,000-200,000
- Score: 0-100

Without scaling, income will dominate the model!

### One-Hot Encode Categories

```javascript
const categories = ['red', 'blue', 'green'];

return items.map(item => {
  const encoded = {};

  categories.forEach(cat => {
    encoded[`color_${cat}`] = item.json.color === cat ? 1 : 0;
  });

  return {
    json: {
      ...item.json,
      ...encoded
    }
  };
});
```

## Performance Tips

### Tip 1: Limit Dataset Size for Testing
When developing, use small datasets:

**Sklearn Datasets:**
- Set samples to 100 instead of 1000
- Use fewer features (2-3 for testing)

**External Data:**
- Add a **Limit** node after data source
- Test with 50-100 rows first

### Tip 2: Cache Trained Models
Store model JSON in n8n variables or external storage to avoid retraining:

```javascript
// After training, save model
return [{
  json: {
    model_json: items[0].json.model,
    timestamp: Date.now()
  }
}];
```

### Tip 3: Batch Predictions
Process predictions in batches rather than one-by-one.

## Quick Reference: Column Selection

| Source | Feature Columns | Target Column |
|--------|----------------|---------------|
| Diabetes Dataset | `age,sex,bmi,bp,s1,s2,s3,s4,s5,s6` | `target_numeric` |
| Iris Dataset | `sepal length (cm),sepal width (cm),petal length (cm),petal width (cm)` | `target_numeric` |
| Make Regression (3 features) | `feature_0,feature_1,feature_2` | `target_numeric` |
| After Standard Scaler (prefix: scaled_) | `scaled_age,scaled_bmi,scaled_bp` | `target_numeric` |

## Need Help?

1. **Check node output** - Click on nodes to see actual data structure
2. **Use Code nodes** - Log column names and data types
3. **Start simple** - Use Sklearn Datasets first to understand the workflow
4. **Read errors carefully** - Error messages tell you exactly which column is missing
5. **Check TROUBLESHOOTING.md** - Common errors and solutions

Happy machine learning! 🤖

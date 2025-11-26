# Troubleshooting Guide

## Common Errors and Solutions

### Error: "Target column 'X' not found in item"

**Cause**: The column name you specified doesn't exist in your input data.

**Solution**:
1. Check the output of the previous node to see available column names
2. Make sure column names match exactly (case-sensitive)
3. Remove any expressions (=) if you're using field names directly

### Error: Target column contains non-numeric data

**Problem**: Linear Regression requires numeric data, but you have text/categorical data.

**Example**: Trying to predict "country" (text) or "name" (text)

**Solutions**:

#### Solution 1: Encode Categorical Data

Add a **Code** node before the Linear Regression node:

```javascript
// Encode categorical 'country' to numeric
const countryMap = {};
let countryId = 0;

return items.map(item => {
  const country = item.json.country;

  // Assign numeric ID to each unique country
  if (!countryMap[country]) {
    countryMap[country] = countryId++;
  }

  return {
    json: {
      ...item.json,
      country_encoded: countryMap[country]
    }
  };
});
```

Then use `country_encoded` as your target column.

#### Solution 2: Use One-Hot Encoding

For multiple categories, create binary columns:

```javascript
// One-hot encode country
return items.map(item => {
  const country = item.json.country;

  return {
    json: {
      ...item.json,
      is_usa: country === 'USA' ? 1 : 0,
      is_canada: country === 'Canada' ? 1 : 0,
      is_uk: country === 'UK' ? 1 : 0,
      // Add more countries as needed
    }
  };
});
```

#### Solution 3: Choose a Numeric Target

Use a column that's already numeric:
- `id`
- `age`
- `salary`
- `score`
- Any numeric measurement

### Error: Feature column contains dates

**Problem**: Date fields like `created` or `updatedAt` aren't numeric.

**Solution**: Convert dates to timestamps in a Code node:

```javascript
return items.map(item => {
  return {
    json: {
      ...item.json,
      created_timestamp: new Date(item.json.created).getTime(),
      // Convert to days since epoch for smaller numbers
      created_days: Math.floor(new Date(item.json.created).getTime() / (1000 * 60 * 60 * 24))
    }
  };
});
```

Then use `created_timestamp` or `created_days` as features.

### Error: Python script failed

**Common Causes**:

1. **Python not found**
   ```bash
   which python3
   ```
   Use the full path in the node's "Python Path" field

2. **scikit-learn not installed**
   ```bash
   pip3 install scikit-learn numpy
   ```

3. **Wrong Python environment**
   If using virtual environment:
   ```bash
   which python  # inside activated venv
   ```

### Error: Not enough data

**Problem**: Too few samples for training

**Solution**: Linear Regression needs at least 2 data points, preferably many more (10+ recommended)

### Example: Working Setup for Customer Data

Assuming your customer data has:
- `id` (number)
- `name` (text)
- `email` (text)
- `country` (text)
- `created` (date)
- `customFields` (object/number)

**Working Example 1: Predict ID from timestamp**

1. **Code Node** - Prepare data:
```javascript
return items.map(item => {
  return {
    json: {
      ...item.json,
      created_days: Math.floor(new Date(item.json.created).getTime() / (1000 * 60 * 60 * 24))
    }
  };
});
```

2. **Linear Regression Node**:
   - Operation: Train
   - Feature Columns: `created_days`
   - Target Column: `id`

**Working Example 2: Predict with encoded country**

1. **Code Node** - Encode country:
```javascript
const countryMap = { 'USA': 1, 'Canada': 2, 'UK': 3, 'Germany': 4 };

return items.map(item => {
  return {
    json: {
      ...item.json,
      country_encoded: countryMap[item.json.country] || 0,
      created_timestamp: new Date(item.json.created).getTime()
    }
  };
});
```

2. **Linear Regression Node**:
   - Operation: Train
   - Feature Columns: `created_timestamp`
   - Target Column: `country_encoded`

Note: Predicting categorical data with Linear Regression isn't ideal. Consider using classification algorithms for categorical predictions.

### Best Practices

1. **Always check your data first**: Look at the output of the previous node
2. **Use numeric data**: Convert text and dates to numbers
3. **Normalize features**: Use Standard Scaler for features with different scales
4. **Have enough data**: 10+ samples minimum, 100+ recommended
5. **Check for null values**: Remove or fill missing data

### Data Preparation Checklist

- [ ] All feature columns exist in the data
- [ ] All feature columns contain numeric values
- [ ] Target column exists in the data
- [ ] Target column contains numeric values
- [ ] No null/undefined values in features or target
- [ ] Have at least 10+ data points
- [ ] Column names match exactly (case-sensitive)

## Getting More Help

If you're still stuck:

1. Check the node output to see the actual data structure
2. Add a Code node to inspect: `return items`
3. Look at the error message for the specific column name
4. Verify the data type (number vs string vs date)

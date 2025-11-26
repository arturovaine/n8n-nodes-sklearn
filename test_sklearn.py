#!/usr/bin/env python3
"""
Test script to verify scikit-learn integration for n8n nodes
"""

import json
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler

def test_linear_regression():
    """Test Linear Regression functionality"""
    print("Testing Linear Regression...")

    # Sample data
    X = np.array([[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]])
    y = np.array([5, 8, 11, 14, 17])

    # Train model
    model = LinearRegression(fit_intercept=True)
    model.fit(X, y)

    # Results
    print(f"  Coefficients: {model.coef_}")
    print(f"  Intercept: {model.intercept_}")
    print(f"  R² Score: {model.score(X, y)}")

    # Make prediction
    X_test = np.array([[3, 4]])
    prediction = model.predict(X_test)
    print(f"  Prediction for [3, 4]: {prediction[0]}")

    # Export model as JSON (simulating n8n node output)
    model_json = {
        'coefficients': model.coef_.tolist(),
        'intercept': float(model.intercept_),
        'score': float(model.score(X, y)),
        'feature_columns': ['x1', 'x2'],
        'fit_intercept': True
    }
    print(f"  Model JSON: {json.dumps(model_json)}")
    print("  ✓ Linear Regression test passed!\n")
    return True

def test_standard_scaler():
    """Test Standard Scaler functionality"""
    print("Testing Standard Scaler...")

    # Sample data
    X = np.array([[25, 50000, 85],
                  [35, 75000, 92],
                  [45, 95000, 98],
                  [22, 30000, 78],
                  [28, 40000, 82]])

    # Fit scaler
    scaler = StandardScaler(with_mean=True, with_std=True)
    scaler.fit(X)

    # Results
    print(f"  Mean: {scaler.mean_}")
    print(f"  Scale: {scaler.scale_}")
    print(f"  Variance: {scaler.var_}")

    # Transform data
    X_scaled = scaler.transform(X)
    print(f"  First row scaled: {X_scaled[0]}")

    # Export scaler as JSON
    scaler_json = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'var': scaler.var_.tolist(),
        'feature_columns': ['age', 'income', 'score'],
        'with_mean': True,
        'with_std': True
    }
    print(f"  Scaler JSON: {json.dumps(scaler_json)}")
    print("  ✓ Standard Scaler test passed!\n")
    return True

def test_integration():
    """Test full integration: scale + train + predict"""
    print("Testing Full Integration Pipeline...")

    # Sample data
    data = [
        {'hours_studied': 1, 'previous_score': 50, 'final_score': 55},
        {'hours_studied': 2, 'previous_score': 60, 'final_score': 65},
        {'hours_studied': 3, 'previous_score': 70, 'final_score': 75},
        {'hours_studied': 4, 'previous_score': 80, 'final_score': 85},
        {'hours_studied': 5, 'previous_score': 90, 'final_score': 95}
    ]

    # Extract features and target
    X = np.array([[d['hours_studied'], d['previous_score']] for d in data])
    y = np.array([d['final_score'] for d in data])

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    print(f"  Scaled features (first row): {X_scaled[0]}")

    # Train model on scaled data
    model = LinearRegression()
    model.fit(X_scaled, y)
    print(f"  Model R² Score: {model.score(X_scaled, y)}")

    # Make prediction on new data
    new_data = np.array([[3.5, 75]])
    new_data_scaled = scaler.transform(new_data)
    prediction = model.predict(new_data_scaled)
    print(f"  Prediction for [3.5, 75]: {prediction[0]}")
    print("  ✓ Integration test passed!\n")
    return True

if __name__ == '__main__':
    print("=" * 60)
    print("Scikit-learn Integration Tests for n8n Nodes")
    print("=" * 60 + "\n")

    try:
        test_linear_regression()
        test_standard_scaler()
        test_integration()

        print("=" * 60)
        print("ALL TESTS PASSED! ✓")
        print("=" * 60)
        print("\nYour environment is ready for n8n-nodes-sklearn!")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnLinearRegression implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Linear Regression',
    name: 'sklearnLinearRegression',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Perform linear regression using scikit-learn',
    defaults: {
      name: 'Sklearn Linear Regression',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Train',
            value: 'train',
            description: 'Train a linear regression model',
            action: 'Train a linear regression model',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions using a trained model',
            action: 'Make predictions using a trained model',
          },
        ],
        default: 'train',
      },
      // Train operation parameters
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names (X variables)',
        required: true,
      },
      {
        displayName: 'Target Column',
        name: 'targetColumn',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: '',
        placeholder: 'target',
        description: 'Name of the target column (Y variable)',
        required: true,
      },
      {
        displayName: 'Fit Intercept',
        name: 'fitIntercept',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: true,
        description: 'Whether to calculate the intercept for this model',
      },
      // Predict operation parameters
      {
        displayName: 'Model Data',
        name: 'modelData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict'],
          },
        },
        default: '',
        description: 'JSON string containing the trained model (from train operation)',
        required: true,
      },
      {
        displayName: 'Feature Columns',
        name: 'predictFeatureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names (must match training features)',
        required: true,
      },
      {
        displayName: 'Python Path',
        name: 'pythonPath',
        type: 'string',
        default: 'python3',
        description: 'Path to Python executable with scikit-learn installed',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        if (operation === 'train') {
          const featureColumnsStr = this.getNodeParameter('featureColumns', itemIndex) as string;
          const targetColumn = this.getNodeParameter('targetColumn', itemIndex) as string;
          const fitIntercept = this.getNodeParameter('fitIntercept', itemIndex) as boolean;

          const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

          // Extract data from all items for training
          const trainingData = items.map((item) => {
            const features = featureColumns.map((col) => {
              const value = item.json[col];
              if (value === undefined || value === null) {
                throw new NodeOperationError(
                  this.getNode(),
                  `Feature column '${col}' not found in item`,
                  { itemIndex }
                );
              }
              return parseFloat(String(value));
            });

            const target = item.json[targetColumn];
            if (target === undefined || target === null) {
              throw new NodeOperationError(
                this.getNode(),
                `Target column '${targetColumn}' not found in item`,
                { itemIndex }
              );
            }

            return {
              features,
              target: parseFloat(String(target)),
            };
          });

          // Create Python script for training
          const pythonScript = `
import json
import sys
import numpy as np
from sklearn.linear_model import LinearRegression

# Read input data
data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

# Train model
model = LinearRegression(fit_intercept=${fitIntercept ? 'True' : 'False'})
model.fit(X, y)

# Export model parameters
result = {
    'coefficients': model.coef_.tolist(),
    'intercept': float(model.intercept_),
    'score': float(model.score(X, y)),
    'feature_columns': ${JSON.stringify(featureColumns)},
    'fit_intercept': ${fitIntercept ? 'True' : 'False'}
}

print(json.dumps(result))
`;

          // Execute Python script
          const { spawn } = require('child_process');
          const modelData = await new Promise<string>((resolve, reject) => {
            const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(trainingData)]);
            let output = '';
            let errorOutput = '';

            python.stdout.on('data', (data: Buffer) => {
              output += data.toString();
            });

            python.stderr.on('data', (data: Buffer) => {
              errorOutput += data.toString();
            });

            python.on('close', (code: number) => {
              if (code !== 0) {
                reject(new Error(`Python script failed: ${errorOutput}`));
              } else {
                resolve(output.trim());
              }
            });
          });

          const model = JSON.parse(modelData);

          returnData.push({
            json: {
              model: modelData,
              coefficients: model.coefficients,
              intercept: model.intercept,
              r2_score: model.score,
              feature_columns: model.feature_columns,
              training_samples: items.length,
            },
          });
        } else if (operation === 'predict') {
          const modelDataStr = this.getNodeParameter('modelData', itemIndex) as string;
          const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', itemIndex) as string;

          const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
          const modelData = JSON.parse(modelDataStr);

          // Extract features from current item
          const features = featureColumns.map((col) => {
            const value = items[itemIndex].json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(
                this.getNode(),
                `Feature column '${col}' not found in item`,
                { itemIndex }
              );
            }
            return parseFloat(String(value));
          });

          // Create Python script for prediction
          const pythonScript = `
import json
import sys
import numpy as np

# Read model and input data
model_data = json.loads(sys.argv[1])
features = json.loads(sys.argv[2])

# Make prediction
X = np.array([features])
coefficients = np.array(model_data['coefficients'])
intercept = model_data['intercept']

prediction = float(np.dot(X, coefficients) + intercept)

print(json.dumps({'prediction': prediction}))
`;

          const { spawn } = require('child_process');
          const predictionData = await new Promise<string>((resolve, reject) => {
            const python = spawn(pythonPath, [
              '-c',
              pythonScript,
              modelDataStr,
              JSON.stringify(features),
            ]);
            let output = '';
            let errorOutput = '';

            python.stdout.on('data', (data: Buffer) => {
              output += data.toString();
            });

            python.stderr.on('data', (data: Buffer) => {
              errorOutput += data.toString();
            });

            python.on('close', (code: number) => {
              if (code !== 0) {
                reject(new Error(`Python script failed: ${errorOutput}`));
              } else {
                resolve(output.trim());
              }
            });
          });

          const result = JSON.parse(predictionData);

          returnData.push({
            json: {
              ...items[itemIndex].json,
              prediction: result.prediction,
            },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

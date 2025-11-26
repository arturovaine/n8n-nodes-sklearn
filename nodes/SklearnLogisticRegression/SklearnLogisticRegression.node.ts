import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnLogisticRegression implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Logistic Regression',
    name: 'sklearnLogisticRegression',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Perform logistic regression classification using scikit-learn',
    defaults: {
      name: 'Sklearn Logistic Regression',
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
            description: 'Train a logistic regression classifier',
            action: 'Train a logistic regression classifier',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions using a trained model',
            action: 'Make predictions using a trained model',
          },
          {
            name: 'Predict Probability',
            value: 'predictProba',
            description: 'Get class probabilities for predictions',
            action: 'Get class probabilities',
          },
        ],
        default: 'train',
      },
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
        description: 'Name of the target column (Y variable - class labels)',
        required: true,
      },
      {
        displayName: 'Solver',
        name: 'solver',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'LBFGS', value: 'lbfgs', description: 'Good for small datasets' },
          { name: 'Liblinear', value: 'liblinear', description: 'Good for small datasets, supports L1' },
          { name: 'Newton-CG', value: 'newton-cg', description: 'Good for multiclass' },
          { name: 'SAG', value: 'sag', description: 'Fast for large datasets' },
          { name: 'SAGA', value: 'saga', description: 'Fast, supports L1 and multiclass' },
        ],
        default: 'lbfgs',
        description: 'Algorithm to use for optimization',
      },
      {
        displayName: 'Max Iterations',
        name: 'maxIter',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 100,
        description: 'Maximum number of iterations for solver convergence',
      },
      {
        displayName: 'Regularization (C)',
        name: 'regularization',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 1.0,
        description: 'Inverse of regularization strength. Smaller values = stronger regularization.',
      },
      {
        displayName: 'Model Data',
        name: 'modelData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict', 'predictProba'],
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
            operation: ['predict', 'predictProba'],
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

    try {
      if (operation === 'train') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
        const solver = this.getNodeParameter('solver', 0) as string;
        const maxIter = this.getNodeParameter('maxIter', 0) as number;
        const regularization = this.getNodeParameter('regularization', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const trainingData = items.map((item, idx) => {
          const features = featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(
                this.getNode(),
                `Feature column '${col}' not found in item`,
                { itemIndex: idx }
              );
            }
            return parseFloat(String(value));
          });

          const target = item.json[targetColumn];
          if (target === undefined || target === null) {
            throw new NodeOperationError(
              this.getNode(),
              `Target column '${targetColumn}' not found in item`,
              { itemIndex: idx }
            );
          }

          return { features, target };
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = LogisticRegression(solver='${solver}', max_iter=${maxIter}, C=${regularization})
model.fit(X, y)

result = {
    'coefficients': model.coef_.tolist(),
    'intercept': model.intercept_.tolist(),
    'classes': model.classes_.tolist(),
    'score': float(model.score(X, y)),
    'feature_columns': ${JSON.stringify(featureColumns)},
    'n_features': len(${JSON.stringify(featureColumns)}),
    'solver': '${solver}',
    'max_iter': ${maxIter},
    'C': ${regularization}
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const modelData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(trainingData)]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const model = JSON.parse(modelData);

        returnData.push({
          json: {
            model: modelData,
            coefficients: model.coefficients,
            intercept: model.intercept,
            classes: model.classes,
            accuracy: model.score,
            feature_columns: model.feature_columns,
            training_samples: items.length,
          },
        });

      } else if (operation === 'predict' || operation === 'predictProba') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const modelData = JSON.parse(modelDataStr);

        const allFeatures = items.map((item, idx) => {
          return featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(
                this.getNode(),
                `Feature column '${col}' not found in item`,
                { itemIndex: idx }
              );
            }
            return parseFloat(String(value));
          });
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.linear_model import LogisticRegression

model_data = json.loads(sys.argv[1])
features = json.loads(sys.argv[2])
X = np.array(features)

model = LogisticRegression()
model.coef_ = np.array(model_data['coefficients'])
model.intercept_ = np.array(model_data['intercept'])
model.classes_ = np.array(model_data['classes'])

predictions = model.predict(X).tolist()
probabilities = model.predict_proba(X).tolist()

print(json.dumps({'predictions': predictions, 'probabilities': probabilities}))
`;

        const { spawn } = require('child_process');
        const predictionData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, modelDataStr, JSON.stringify(allFeatures)]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const result = JSON.parse(predictionData);

        for (let i = 0; i < items.length; i++) {
          const outputJson: any = { ...items[i].json, prediction: result.predictions[i] };

          if (operation === 'predictProba') {
            outputJson.probabilities = result.probabilities[i];
            const classes = modelData.classes;
            outputJson.class_probabilities = {};
            classes.forEach((cls: any, idx: number) => {
              outputJson.class_probabilities[cls] = result.probabilities[i][idx];
            });
          }

          returnData.push({ json: outputJson });
        }
      }
    } catch (error) {
      if (this.continueOnFail()) {
        returnData.push({ json: { error: (error as Error).message } });
      } else {
        throw error;
      }
    }

    return [returnData];
  }
}

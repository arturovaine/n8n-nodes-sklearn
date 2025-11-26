import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnElasticNet implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Elastic Net',
    name: 'sklearnElasticNet',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Elastic Net regression (L1 + L2 regularization) using scikit-learn',
    defaults: {
      name: 'Sklearn Elastic Net',
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
            description: 'Train an Elastic Net model',
            action: 'Train model',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions',
            action: 'Predict',
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
        description: 'Comma-separated list of feature column names',
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
        description: 'Name of the target column',
        required: true,
      },
      {
        displayName: 'Alpha',
        name: 'alpha',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 1.0,
        description: 'Regularization strength (higher = more regularization)',
      },
      {
        displayName: 'L1 Ratio',
        name: 'l1Ratio',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 0.5,
        description: 'Mix ratio between L1 and L2 (0=Ridge, 1=Lasso, 0.5=balanced)',
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
        default: 1000,
        description: 'Maximum number of iterations',
      },
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
        description: 'JSON string containing the trained model',
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
        description: 'Comma-separated list of feature column names',
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
        const alpha = this.getNodeParameter('alpha', 0) as number;
        const l1Ratio = this.getNodeParameter('l1Ratio', 0) as number;
        const maxIter = this.getNodeParameter('maxIter', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const trainingData = items.map((item, idx) => {
          const features = featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });

          const target = item.json[targetColumn];
          if (target === undefined || target === null) {
            throw new NodeOperationError(this.getNode(), `Target column '${targetColumn}' not found`, { itemIndex: idx });
          }

          return { features, target: parseFloat(String(target)) };
        });

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.linear_model import ElasticNet

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ElasticNet(
    alpha=${alpha},
    l1_ratio=${l1Ratio},
    max_iter=${maxIter}
)

model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'score': float(model.score(X, y)),
    'coefficients': model.coef_.tolist(),
    'intercept': float(model.intercept_),
    'n_iter': int(model.n_iter_),
    'alpha': ${alpha},
    'l1_ratio': ${l1Ratio},
    'feature_columns': ${JSON.stringify(featureColumns)}
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
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

        const result = JSON.parse(resultData);

        returnData.push({
          json: {
            model: resultData,
            r2_score: result.score,
            coefficients: Object.fromEntries(featureColumns.map((col, i) => [col, result.coefficients[i]])),
            intercept: result.intercept,
            n_iterations: result.n_iter,
            alpha: result.alpha,
            l1_ratio: result.l1_ratio,
            feature_columns: result.feature_columns,
            training_samples: items.length,
          },
        });

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const features = items.map((item, idx) => {
          return featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64

model_data = json.loads(sys.argv[1])
X = np.array(json.loads(sys.argv[2]))

model_bytes = base64.b64decode(model_data['model_pickle'])
model = pickle.loads(model_bytes)

predictions = model.predict(X).tolist()

result = {'predictions': predictions}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, modelDataStr, JSON.stringify(features)]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const result = JSON.parse(resultData);

        for (let i = 0; i < items.length; i++) {
          returnData.push({
            json: {
              ...items[i].json,
              prediction: result.predictions[i],
            },
          });
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

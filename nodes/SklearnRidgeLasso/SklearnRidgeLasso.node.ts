import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnRidgeLasso implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Ridge/Lasso',
    name: 'sklearnRidgeLasso',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["modelType"]}} - {{$parameter["operation"]}}',
    description: 'Ridge (L2) and Lasso (L1) regularized regression using scikit-learn',
    defaults: {
      name: 'Sklearn Ridge/Lasso',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Model Type',
        name: 'modelType',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Ridge (L2)', value: 'Ridge', description: 'L2 regularization' },
          { name: 'Lasso (L1)', value: 'Lasso', description: 'L1 regularization (sparse solutions)' },
        ],
        default: 'Ridge',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Train',
            value: 'train',
            description: 'Train the model',
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
        displayName: 'Max Iterations (Lasso only)',
        name: 'maxIter',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
            modelType: ['Lasso'],
          },
        },
        default: 1000,
        description: 'Maximum number of iterations for Lasso',
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
    const modelType = this.getNodeParameter('modelType', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    try {
      if (operation === 'train') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
        const alpha = this.getNodeParameter('alpha', 0) as number;

        let maxIter = 1000;
        if (modelType === 'Lasso') {
          maxIter = this.getNodeParameter('maxIter', 0) as number;
        }

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

        const modelParams = modelType === 'Lasso' ? `alpha=${alpha}, max_iter=${maxIter}` : `alpha=${alpha}`;

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.linear_model import ${modelType}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelType}(${modelParams})
model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'model_type': '${modelType}',
    'score': float(model.score(X, y)),
    'coefficients': model.coef_.tolist(),
    'intercept': float(model.intercept_),
    'alpha': ${alpha},
    'feature_columns': ${JSON.stringify(featureColumns)}
}

# Count non-zero coefficients for Lasso
if '${modelType}' == 'Lasso':
    result['n_nonzero_coefficients'] = int(np.sum(model.coef_ != 0))
    result['n_iter'] = int(model.n_iter_)

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

        const outputJson: any = {
          model: resultData,
          model_type: result.model_type,
          r2_score: result.score,
          coefficients: Object.fromEntries(featureColumns.map((col, i) => [col, result.coefficients[i]])),
          intercept: result.intercept,
          alpha: result.alpha,
          feature_columns: result.feature_columns,
          training_samples: items.length,
        };

        if (result.n_nonzero_coefficients !== undefined) {
          outputJson.n_nonzero_coefficients = result.n_nonzero_coefficients;
          outputJson.n_iterations = result.n_iter;
        }

        returnData.push({ json: outputJson });

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

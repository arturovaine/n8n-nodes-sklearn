import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnGradientBoosting implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Gradient Boosting',
    name: 'sklearnGradientBoosting',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["modelType"]}} - {{$parameter["operation"]}}',
    description: 'Gradient Boosting classifier and regressor using scikit-learn',
    defaults: {
      name: 'Sklearn Gradient Boosting',
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
          {
            name: 'Classifier',
            value: 'classifier',
            description: 'For classification tasks',
          },
          {
            name: 'Regressor',
            value: 'regressor',
            description: 'For regression tasks',
          },
        ],
        default: 'classifier',
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
            description: 'Train a gradient boosting model',
            action: 'Train a gradient boosting model',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions using a trained model',
            action: 'Make predictions',
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
        displayName: 'Number of Estimators',
        name: 'nEstimators',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 100,
        description: 'Number of boosting stages',
      },
      {
        displayName: 'Learning Rate',
        name: 'learningRate',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 0.1,
        description: 'Shrinks contribution of each tree',
      },
      {
        displayName: 'Max Depth',
        name: 'maxDepth',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 3,
        description: 'Maximum depth of individual trees',
      },
      {
        displayName: 'Min Samples Split',
        name: 'minSamplesSplit',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 2,
        description: 'Minimum samples required to split an internal node',
      },
      {
        displayName: 'Subsample',
        name: 'subsample',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 1.0,
        description: 'Fraction of samples used for fitting trees (< 1.0 enables stochastic gradient boosting)',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 42,
        description: 'Random seed for reproducibility',
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
        const nEstimators = this.getNodeParameter('nEstimators', 0) as number;
        const learningRate = this.getNodeParameter('learningRate', 0) as number;
        const maxDepth = this.getNodeParameter('maxDepth', 0) as number;
        const minSamplesSplit = this.getNodeParameter('minSamplesSplit', 0) as number;
        const subsample = this.getNodeParameter('subsample', 0) as number;
        const randomState = this.getNodeParameter('randomState', 0) as number;

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

          return { features, target: modelType === 'regressor' ? parseFloat(String(target)) : target };
        });

        const modelClass = modelType === 'classifier' ? 'GradientBoostingClassifier' : 'GradientBoostingRegressor';

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.ensemble import ${modelClass}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelClass}(
    n_estimators=${nEstimators},
    learning_rate=${learningRate},
    max_depth=${maxDepth},
    min_samples_split=${minSamplesSplit},
    subsample=${subsample},
    random_state=${randomState}
)
model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'model_type': '${modelType}',
    'score': float(model.score(X, y)),
    'feature_importances': model.feature_importances_.tolist(),
    'feature_columns': ${JSON.stringify(featureColumns)},
    'n_estimators': ${nEstimators},
    'learning_rate': ${learningRate},
    'max_depth': ${maxDepth}
}

if '${modelType}' == 'classifier':
    result['classes'] = model.classes_.tolist()

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
            model_type: model.model_type,
            score: model.score,
            feature_importances: model.feature_importances,
            feature_columns: model.feature_columns,
            classes: model.classes,
            n_estimators: model.n_estimators,
            learning_rate: model.learning_rate,
            training_samples: items.length,
          },
        });

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const modelInfo = JSON.parse(modelDataStr);

        const allFeatures = items.map((item, idx) => {
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
features = json.loads(sys.argv[2])
X = np.array(features)

model_bytes = base64.b64decode(model_data['model_pickle'])
model = pickle.loads(model_bytes)

predictions = model.predict(X).tolist()

result = {'predictions': predictions}

if model_data['model_type'] == 'classifier':
    result['probabilities'] = model.predict_proba(X).tolist()

print(json.dumps(result))
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
          if (result.probabilities) {
            outputJson.probabilities = result.probabilities[i];
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

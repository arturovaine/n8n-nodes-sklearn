import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnKNN implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn KNN',
    name: 'sklearnKNN',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["modelType"]}} - {{$parameter["operation"]}}',
    description: 'K-Nearest Neighbors classifier and regressor using scikit-learn',
    defaults: {
      name: 'Sklearn KNN',
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
            description: 'Train a KNN model',
            action: 'Train a KNN model',
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
        displayName: 'Number of Neighbors (K)',
        name: 'nNeighbors',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 5,
        description: 'Number of neighbors to use',
      },
      {
        displayName: 'Weights',
        name: 'weights',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Uniform', value: 'uniform', description: 'All neighbors weighted equally' },
          { name: 'Distance', value: 'distance', description: 'Closer neighbors have more weight' },
        ],
        default: 'uniform',
        description: 'Weight function used in prediction',
      },
      {
        displayName: 'Algorithm',
        name: 'algorithm',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Auto', value: 'auto', description: 'Automatically choose best algorithm' },
          { name: 'Ball Tree', value: 'ball_tree', description: 'Use BallTree' },
          { name: 'KD Tree', value: 'kd_tree', description: 'Use KDTree' },
          { name: 'Brute', value: 'brute', description: 'Brute-force search' },
        ],
        default: 'auto',
        description: 'Algorithm used to compute nearest neighbors',
      },
      {
        displayName: 'Metric',
        name: 'metric',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Euclidean', value: 'euclidean', description: 'Standard Euclidean distance' },
          { name: 'Manhattan', value: 'manhattan', description: 'Sum of absolute differences' },
          { name: 'Minkowski', value: 'minkowski', description: 'Generalized distance' },
          { name: 'Cosine', value: 'cosine', description: 'Cosine similarity' },
        ],
        default: 'euclidean',
        description: 'Distance metric',
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
        const nNeighbors = this.getNodeParameter('nNeighbors', 0) as number;
        const weights = this.getNodeParameter('weights', 0) as string;
        const algorithm = this.getNodeParameter('algorithm', 0) as string;
        const metric = this.getNodeParameter('metric', 0) as string;

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

        const modelClass = modelType === 'classifier' ? 'KNeighborsClassifier' : 'KNeighborsRegressor';

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.neighbors import ${modelClass}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelClass}(
    n_neighbors=${nNeighbors},
    weights='${weights}',
    algorithm='${algorithm}',
    metric='${metric}'
)
model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'model_type': '${modelType}',
    'score': float(model.score(X, y)),
    'n_neighbors': ${nNeighbors},
    'weights': '${weights}',
    'algorithm': '${algorithm}',
    'metric': '${metric}',
    'feature_columns': ${JSON.stringify(featureColumns)},
    'n_samples': len(X)
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
            n_neighbors: model.n_neighbors,
            weights: model.weights,
            metric: model.metric,
            classes: model.classes,
            feature_columns: model.feature_columns,
            training_samples: model.n_samples,
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

# Get distances and indices of nearest neighbors
distances, indices = model.kneighbors(X)
result['neighbor_distances'] = distances.tolist()
result['neighbor_indices'] = indices.tolist()

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
          const outputJson: any = {
            ...items[i].json,
            prediction: result.predictions[i],
            neighbor_distances: result.neighbor_distances[i],
            neighbor_indices: result.neighbor_indices[i],
          };
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

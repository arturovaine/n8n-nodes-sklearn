import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnMLP implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn MLP Neural Network',
    name: 'sklearnMLP',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["modelType"]}} - {{$parameter["operation"]}}',
    description: 'Multi-layer Perceptron neural network using scikit-learn',
    defaults: {
      name: 'Sklearn MLP',
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
          { name: 'Classifier', value: 'MLPClassifier' },
          { name: 'Regressor', value: 'MLPRegressor' },
        ],
        default: 'MLPClassifier',
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
            description: 'Train the neural network',
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
        displayName: 'Hidden Layer Sizes',
        name: 'hiddenLayerSizes',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: '100,50',
        placeholder: '100,50,25',
        description: 'Comma-separated list of neurons per hidden layer',
      },
      {
        displayName: 'Activation',
        name: 'activation',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'ReLU', value: 'relu' },
          { name: 'Tanh', value: 'tanh' },
          { name: 'Logistic (Sigmoid)', value: 'logistic' },
          { name: 'Identity', value: 'identity' },
        ],
        default: 'relu',
        description: 'Activation function for hidden layers',
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
          { name: 'Adam', value: 'adam' },
          { name: 'SGD', value: 'sgd' },
          { name: 'L-BFGS', value: 'lbfgs' },
        ],
        default: 'adam',
        description: 'Optimization algorithm',
      },
      {
        displayName: 'Learning Rate',
        name: 'learningRateInit',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 0.001,
        description: 'Initial learning rate',
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
        default: 200,
        description: 'Maximum number of iterations',
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
        const hiddenLayerSizesStr = this.getNodeParameter('hiddenLayerSizes', 0) as string;
        const activation = this.getNodeParameter('activation', 0) as string;
        const solver = this.getNodeParameter('solver', 0) as string;
        const learningRateInit = this.getNodeParameter('learningRateInit', 0) as number;
        const maxIter = this.getNodeParameter('maxIter', 0) as number;
        const randomState = this.getNodeParameter('randomState', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const hiddenLayerSizes = hiddenLayerSizesStr.split(',').map((s) => parseInt(s.trim(), 10));

        const isRegressor = modelType === 'MLPRegressor';

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

          return { features, target: isRegressor ? parseFloat(String(target)) : target };
        });

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.neural_network import ${modelType}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelType}(
    hidden_layer_sizes=tuple(${JSON.stringify(hiddenLayerSizes)}),
    activation='${activation}',
    solver='${solver}',
    learning_rate_init=${learningRateInit},
    max_iter=${maxIter},
    random_state=${randomState}
)

model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'model_type': '${modelType}',
    'score': float(model.score(X, y)),
    'n_layers': model.n_layers_,
    'n_iter': model.n_iter_,
    'loss': float(model.loss_),
    'hidden_layer_sizes': ${JSON.stringify(hiddenLayerSizes)},
    'activation': '${activation}',
    'feature_columns': ${JSON.stringify(featureColumns)}
}

if '${modelType}' == 'MLPClassifier':
    result['classes'] = model.classes_.tolist()

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
          score: result.score,
          n_layers: result.n_layers,
          n_iterations: result.n_iter,
          final_loss: result.loss,
          hidden_layer_sizes: result.hidden_layer_sizes,
          activation: result.activation,
          feature_columns: result.feature_columns,
          training_samples: items.length,
        };

        if (result.classes) {
          outputJson.classes = result.classes;
        }

        returnData.push({ json: outputJson });

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const modelInfo = JSON.parse(modelDataStr);

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

if model_data['model_type'] == 'MLPClassifier':
    result['probabilities'] = model.predict_proba(X).tolist()

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
          const outputJson: any = {
            ...items[i].json,
            prediction: result.predictions[i],
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

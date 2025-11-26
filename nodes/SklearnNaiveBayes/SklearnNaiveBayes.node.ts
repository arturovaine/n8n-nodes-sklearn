import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnNaiveBayes implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Naive Bayes',
    name: 'sklearnNaiveBayes',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["variant"]}} - {{$parameter["operation"]}}',
    description: 'Naive Bayes classifiers using scikit-learn',
    defaults: {
      name: 'Sklearn Naive Bayes',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Variant',
        name: 'variant',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Gaussian NB',
            value: 'gaussian',
            description: 'For continuous features (assumes normal distribution)',
          },
          {
            name: 'Multinomial NB',
            value: 'multinomial',
            description: 'For discrete counts (e.g., text classification)',
          },
          {
            name: 'Bernoulli NB',
            value: 'bernoulli',
            description: 'For binary/boolean features',
          },
        ],
        default: 'gaussian',
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
            description: 'Train a Naive Bayes classifier',
            action: 'Train a Naive Bayes classifier',
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
        displayName: 'Alpha (Smoothing)',
        name: 'alpha',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
            variant: ['multinomial', 'bernoulli'],
          },
        },
        default: 1.0,
        description: 'Additive (Laplace) smoothing parameter',
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
        const variant = this.getNodeParameter('variant', 0) as string;
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const targetColumn = this.getNodeParameter('targetColumn', 0) as string;

        let alpha = 1.0;
        if (variant === 'multinomial' || variant === 'bernoulli') {
          alpha = this.getNodeParameter('alpha', 0) as number;
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

          return { features, target };
        });

        const modelClasses: Record<string, string> = {
          gaussian: 'GaussianNB',
          multinomial: 'MultinomialNB',
          bernoulli: 'BernoulliNB',
        };
        const modelClass = modelClasses[variant];
        const alphaParam = variant !== 'gaussian' ? `alpha=${alpha}` : '';

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.naive_bayes import ${modelClass}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelClass}(${alphaParam})
model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'variant': '${variant}',
    'score': float(model.score(X, y)),
    'classes': model.classes_.tolist(),
    'class_prior': model.class_prior_.tolist() if hasattr(model, 'class_prior_') else None,
    'feature_columns': ${JSON.stringify(featureColumns)}
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
            variant: model.variant,
            score: model.score,
            classes: model.classes,
            class_prior: model.class_prior,
            feature_columns: model.feature_columns,
            training_samples: items.length,
          },
        });

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

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
probabilities = model.predict_proba(X).tolist()

result = {
    'predictions': predictions,
    'probabilities': probabilities
}

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
          returnData.push({
            json: {
              ...items[i].json,
              prediction: result.predictions[i],
              probabilities: result.probabilities[i],
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnDatasets implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Datasets',
    name: 'sklearnDatasets',
    icon: 'file:sklearn.svg',
    group: ['input'],
    version: 1,
    subtitle: '={{$parameter["dataset"]}}',
    description: 'Load sample datasets from scikit-learn',
    defaults: {
      name: 'Sklearn Datasets',
    },
    inputs: [],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Dataset',
        name: 'dataset',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Iris',
            value: 'iris',
            description: 'Iris flower dataset (classification, 150 samples, 4 features)',
          },
          {
            name: 'Diabetes',
            value: 'diabetes',
            description: 'Diabetes dataset (regression, 442 samples, 10 features)',
          },
          {
            name: 'Wine',
            value: 'wine',
            description: 'Wine recognition dataset (classification, 178 samples, 13 features)',
          },
          {
            name: 'California Housing',
            value: 'boston',
            description: 'California house prices (regression, 20640 samples, 8 features) - replaces deprecated Boston dataset',
          },
          {
            name: 'Breast Cancer',
            value: 'breast_cancer',
            description: 'Breast cancer dataset (classification, 569 samples, 30 features)',
          },
          {
            name: 'Make Regression',
            value: 'make_regression',
            description: 'Generate synthetic regression dataset',
          },
          {
            name: 'Make Classification',
            value: 'make_classification',
            description: 'Generate synthetic classification dataset',
          },
        ],
        default: 'iris',
      },
      // Options for synthetic datasets
      {
        displayName: 'Number of Samples',
        name: 'nSamples',
        type: 'number',
        displayOptions: {
          show: {
            dataset: ['make_regression', 'make_classification'],
          },
        },
        default: 100,
        description: 'Number of samples to generate',
      },
      {
        displayName: 'Number of Features',
        name: 'nFeatures',
        type: 'number',
        displayOptions: {
          show: {
            dataset: ['make_regression', 'make_classification'],
          },
        },
        default: 4,
        description: 'Number of features to generate',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        displayOptions: {
          show: {
            dataset: ['make_regression', 'make_classification'],
          },
        },
        default: 42,
        description: 'Random seed for reproducibility',
      },
      {
        displayName: 'Include Target',
        name: 'includeTarget',
        type: 'boolean',
        default: true,
        description: 'Whether to include the target variable in the output',
      },
      {
        displayName: 'Output Format',
        name: 'outputFormat',
        type: 'options',
        options: [
          {
            name: 'Rows',
            value: 'rows',
            description: 'Each sample as a separate item (best for n8n workflows)',
          },
          {
            name: 'Arrays',
            value: 'arrays',
            description: 'Features and target as separate arrays',
          },
        ],
        default: 'rows',
        description: 'How to format the output data',
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
    const returnData: INodeExecutionData[] = [];
    const dataset = this.getNodeParameter('dataset', 0) as string;
    const includeTarget = this.getNodeParameter('includeTarget', 0) as boolean;
    const outputFormat = this.getNodeParameter('outputFormat', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    try {
      let pythonScript = '';

      if (dataset === 'make_regression' || dataset === 'make_classification') {
        const nSamples = this.getNodeParameter('nSamples', 0) as number;
        const nFeatures = this.getNodeParameter('nFeatures', 0) as number;
        const randomState = this.getNodeParameter('randomState', 0) as number;

        // Different parameters for regression vs classification
        const extraParams = dataset === 'make_regression' ? 'noise=10.0,' : '';

        pythonScript = `
import json
import numpy as np
from sklearn.datasets import ${dataset}

# Generate synthetic dataset
X, y = ${dataset}(
    n_samples=${nSamples},
    n_features=${nFeatures},
    random_state=${randomState},
    ${extraParams}
)

# Prepare output
result = {
    'X': X.tolist(),
    'y': y.tolist(),
    'feature_names': [f'feature_{i}' for i in range(${nFeatures})],
    'target_name': 'target',
    'n_samples': ${nSamples},
    'n_features': ${nFeatures}
}

print(json.dumps(result))
`;
      } else {
        // Load built-in dataset
        // Boston dataset is handled specially due to removal in sklearn 1.2+
        if (dataset === 'boston') {
          pythonScript = `
import json
import numpy as np
from sklearn.datasets import fetch_california_housing

# Boston was removed, use California Housing instead
data = fetch_california_housing()
`;
        } else {
          const datasetLoader = `load_${dataset}`;
          pythonScript = `
import json
import numpy as np
from sklearn.datasets import ${datasetLoader}

# Load dataset
data = ${datasetLoader}()
`;
        }

        // Add common output preparation code
        pythonScript += `

# Prepare output
# Handle feature_names - might be list or ndarray
if hasattr(data, 'feature_names'):
    feature_names = data.feature_names if isinstance(data.feature_names, list) else data.feature_names.tolist()
else:
    feature_names = [f'feature_{i}' for i in range(data.data.shape[1])]

# Handle target_names - might be list or ndarray
if hasattr(data, 'target_names'):
    target_name = data.target_names if isinstance(data.target_names, list) else data.target_names.tolist()
else:
    target_name = 'target'

result = {
    'X': data.data.tolist(),
    'y': data.target.tolist(),
    'feature_names': feature_names,
    'target_name': target_name,
    'n_samples': data.data.shape[0],
    'n_features': data.data.shape[1],
    'description': data.DESCR if hasattr(data, 'DESCR') else 'No description available'
}

print(json.dumps(result))
`;
      }

      // Execute Python script
      const { spawn } = require('child_process');
      const resultData = await new Promise<string>((resolve, reject) => {
        const python = spawn(pythonPath, ['-c', pythonScript]);
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

      const result = JSON.parse(resultData);

      if (outputFormat === 'rows') {
        // Convert to row format (one item per sample)
        for (let i = 0; i < result.n_samples; i++) {
          const item: any = {};

          // Add features
          result.feature_names.forEach((name: string, idx: number) => {
            item[name] = result.X[i][idx];
          });

          // Add target if requested
          if (includeTarget) {
            const targetValue = Array.isArray(result.target_name)
              ? result.target_name[Math.floor(result.y[i])]
              : result.y[i];
            item.target = targetValue;
            item.target_numeric = result.y[i];
          }

          returnData.push({ json: item });
        }
      } else {
        // Return as arrays
        returnData.push({
          json: {
            features: result.X,
            target: includeTarget ? result.y : undefined,
            feature_names: result.feature_names,
            target_name: result.target_name,
            n_samples: result.n_samples,
            n_features: result.n_features,
            description: result.description,
          },
        });
      }
    } catch (error) {
      throw new NodeOperationError(
        this.getNode(),
        `Failed to load dataset: ${(error as Error).message}`,
      );
    }

    return [returnData];
  }
}

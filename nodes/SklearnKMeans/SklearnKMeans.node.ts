import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnKMeans implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn KMeans',
    name: 'sklearnKMeans',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'K-Means clustering using scikit-learn',
    defaults: {
      name: 'Sklearn KMeans',
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
            name: 'Fit',
            value: 'fit',
            description: 'Fit the KMeans model and get cluster centers',
            action: 'Fit KMeans model',
          },
          {
            name: 'Fit Predict',
            value: 'fitPredict',
            description: 'Fit and assign cluster labels to data',
            action: 'Fit and predict clusters',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Assign cluster labels using a fitted model',
            action: 'Predict cluster labels',
          },
        ],
        default: 'fitPredict',
      },
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names',
        required: true,
      },
      {
        displayName: 'Number of Clusters (K)',
        name: 'nClusters',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
          },
        },
        default: 3,
        description: 'Number of clusters to form',
      },
      {
        displayName: 'Initialization Method',
        name: 'init',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
          },
        },
        options: [
          { name: 'K-Means++', value: 'k-means++', description: 'Smart initialization (recommended)' },
          { name: 'Random', value: 'random', description: 'Random initialization' },
        ],
        default: 'k-means++',
        description: 'Method for initialization',
      },
      {
        displayName: 'Max Iterations',
        name: 'maxIter',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
          },
        },
        default: 300,
        description: 'Maximum number of iterations',
      },
      {
        displayName: 'Number of Initializations',
        name: 'nInit',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
          },
        },
        default: 10,
        description: 'Number of times to run with different centroid seeds',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitPredict'],
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
        description: 'JSON string containing the fitted model',
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
      if (operation === 'fit' || operation === 'fitPredict') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const nClusters = this.getNodeParameter('nClusters', 0) as number;
        const init = this.getNodeParameter('init', 0) as string;
        const maxIter = this.getNodeParameter('maxIter', 0) as number;
        const nInit = this.getNodeParameter('nInit', 0) as number;
        const randomState = this.getNodeParameter('randomState', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const data = items.map((item, idx) => {
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
from sklearn.cluster import KMeans

data = json.loads(sys.argv[1])
X = np.array(data)

model = KMeans(
    n_clusters=${nClusters},
    init='${init}',
    max_iter=${maxIter},
    n_init=${nInit},
    random_state=${randomState}
)

labels = model.fit_predict(X)

result = {
    'cluster_centers': model.cluster_centers_.tolist(),
    'labels': labels.tolist(),
    'inertia': float(model.inertia_),
    'n_clusters': ${nClusters},
    'n_iter': int(model.n_iter_),
    'feature_columns': ${JSON.stringify(featureColumns)}
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const modelData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data)]);
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

        if (operation === 'fit') {
          returnData.push({
            json: {
              model: modelData,
              cluster_centers: model.cluster_centers,
              inertia: model.inertia,
              n_clusters: model.n_clusters,
              n_iterations: model.n_iter,
              feature_columns: model.feature_columns,
              samples_fitted: items.length,
            },
          });
        } else {
          // fitPredict - return items with cluster labels
          for (let i = 0; i < items.length; i++) {
            const outputJson: any = {
              ...items[i].json,
              cluster: model.labels[i],
            };

            // Add model info to first item only
            if (i === 0) {
              outputJson.model = modelData;
              outputJson.cluster_centers = model.cluster_centers;
              outputJson.inertia = model.inertia;
            }

            returnData.push({ json: outputJson });
          }
        }

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const modelInfo = JSON.parse(modelDataStr);

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
from sklearn.cluster import KMeans

model_data = json.loads(sys.argv[1])
features = json.loads(sys.argv[2])
X = np.array(features)

# Reconstruct model from cluster centers
model = KMeans(n_clusters=${modelInfo.n_clusters})
model.cluster_centers_ = np.array(model_data['cluster_centers'])
model._n_threads = 1

labels = model.predict(X)
distances = model.transform(X)

result = {
    'labels': labels.tolist(),
    'distances': distances.tolist()
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
              cluster: result.labels[i],
              distances_to_centers: result.distances[i],
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

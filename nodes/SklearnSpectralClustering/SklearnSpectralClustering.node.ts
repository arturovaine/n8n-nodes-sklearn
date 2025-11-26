import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnSpectralClustering implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Spectral Clustering',
    name: 'sklearnSpectralClustering',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '{{$parameter["nClusters"]}} clusters',
    description: 'Graph-based spectral clustering using scikit-learn',
    defaults: {
      name: 'Sklearn Spectral Clustering',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names',
        required: true,
      },
      {
        displayName: 'Number of Clusters',
        name: 'nClusters',
        type: 'number',
        default: 2,
        description: 'Number of clusters to find',
      },
      {
        displayName: 'Affinity',
        name: 'affinity',
        type: 'options',
        options: [
          { name: 'RBF (Gaussian)', value: 'rbf' },
          { name: 'Nearest Neighbors', value: 'nearest_neighbors' },
          { name: 'Precomputed', value: 'precomputed' },
        ],
        default: 'rbf',
        description: 'How to construct the affinity matrix',
      },
      {
        displayName: 'Number of Neighbors',
        name: 'nNeighbors',
        type: 'number',
        displayOptions: {
          show: {
            affinity: ['nearest_neighbors'],
          },
        },
        default: 10,
        description: 'Number of neighbors for nearest_neighbors affinity',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        default: 42,
        description: 'Random seed for reproducibility',
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

    const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
    const nClusters = this.getNodeParameter('nClusters', 0) as number;
    const affinity = this.getNodeParameter('affinity', 0) as string;
    const randomState = this.getNodeParameter('randomState', 0) as number;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    let nNeighbors = 10;
    if (affinity === 'nearest_neighbors') {
      nNeighbors = this.getNodeParameter('nNeighbors', 0) as number;
    }

    const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

    try {
      const data = items.map((item, idx) => {
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
from sklearn.cluster import SpectralClustering

X = np.array(json.loads(sys.argv[1]))

clustering = SpectralClustering(
    n_clusters=${nClusters},
    affinity='${affinity}',
    n_neighbors=${nNeighbors},
    random_state=${randomState},
    assign_labels='kmeans'
)

labels = clustering.fit_predict(X)

result = {
    'labels': labels.tolist(),
    'n_clusters': ${nClusters},
    'affinity': '${affinity}'
}

print(json.dumps(result))
`;

      const { spawn } = require('child_process');
      const resultData = await new Promise<string>((resolve, reject) => {
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

      const result = JSON.parse(resultData);

      for (let i = 0; i < items.length; i++) {
        returnData.push({
          json: {
            ...items[i].json,
            cluster: result.labels[i],
            n_clusters: result.n_clusters,
          },
        });
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

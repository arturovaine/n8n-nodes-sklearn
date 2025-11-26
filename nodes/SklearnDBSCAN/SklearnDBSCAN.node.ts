import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnDBSCAN implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn DBSCAN',
    name: 'sklearnDBSCAN',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Density-Based Clustering',
    description: 'DBSCAN clustering algorithm using scikit-learn',
    defaults: {
      name: 'Sklearn DBSCAN',
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
        displayName: 'Epsilon (eps)',
        name: 'eps',
        type: 'number',
        default: 0.5,
        description: 'Maximum distance between samples to be considered neighbors',
      },
      {
        displayName: 'Min Samples',
        name: 'minSamples',
        type: 'number',
        default: 5,
        description: 'Minimum samples in a neighborhood to form a core point',
      },
      {
        displayName: 'Metric',
        name: 'metric',
        type: 'options',
        options: [
          { name: 'Euclidean', value: 'euclidean' },
          { name: 'Manhattan', value: 'manhattan' },
          { name: 'Cosine', value: 'cosine' },
          { name: 'Chebyshev', value: 'chebyshev' },
        ],
        default: 'euclidean',
        description: 'Distance metric to use',
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
    const eps = this.getNodeParameter('eps', 0) as number;
    const minSamples = this.getNodeParameter('minSamples', 0) as number;
    const metric = this.getNodeParameter('metric', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

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
from sklearn.cluster import DBSCAN

X = np.array(json.loads(sys.argv[1]))

dbscan = DBSCAN(
    eps=${eps},
    min_samples=${minSamples},
    metric='${metric}'
)

labels = dbscan.fit_predict(X)

n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
n_noise = list(labels).count(-1)

result = {
    'labels': labels.tolist(),
    'n_clusters': n_clusters,
    'n_noise': n_noise,
    'core_sample_indices': dbscan.core_sample_indices_.tolist()
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
            is_noise: result.labels[i] === -1,
            is_core_sample: result.core_sample_indices.includes(i),
            n_clusters: result.n_clusters,
            n_noise: result.n_noise,
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

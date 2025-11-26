import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnAgglomerativeClustering implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Agglomerative Clustering',
    name: 'sklearnAgglomerativeClustering',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Hierarchical Clustering',
    description: 'Agglomerative (hierarchical) clustering using scikit-learn',
    defaults: {
      name: 'Sklearn Agglomerative Clustering',
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
        displayName: 'Linkage',
        name: 'linkage',
        type: 'options',
        options: [
          { name: 'Ward', value: 'ward', description: 'Minimizes variance of merged clusters' },
          { name: 'Complete', value: 'complete', description: 'Maximum distance between clusters' },
          { name: 'Average', value: 'average', description: 'Average distance between clusters' },
          { name: 'Single', value: 'single', description: 'Minimum distance between clusters' },
        ],
        default: 'ward',
        description: 'Linkage criterion for merging clusters',
      },
      {
        displayName: 'Metric',
        name: 'metric',
        type: 'options',
        displayOptions: {
          hide: {
            linkage: ['ward'],
          },
        },
        options: [
          { name: 'Euclidean', value: 'euclidean' },
          { name: 'Manhattan', value: 'manhattan' },
          { name: 'Cosine', value: 'cosine' },
        ],
        default: 'euclidean',
        description: 'Distance metric (ward linkage only supports euclidean)',
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
    const linkage = this.getNodeParameter('linkage', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    let metric = 'euclidean';
    if (linkage !== 'ward') {
      metric = this.getNodeParameter('metric', 0) as string;
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
from sklearn.cluster import AgglomerativeClustering

X = np.array(json.loads(sys.argv[1]))

clustering = AgglomerativeClustering(
    n_clusters=${nClusters},
    linkage='${linkage}',
    metric='${metric}'
)

labels = clustering.fit_predict(X)

result = {
    'labels': labels.tolist(),
    'n_clusters': ${nClusters},
    'n_leaves': int(clustering.n_leaves_),
    'n_connected_components': int(clustering.n_connected_components_)
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
            n_leaves: result.n_leaves,
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

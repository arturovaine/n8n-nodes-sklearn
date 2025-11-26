import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnMeanShift implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Mean Shift',
    name: 'sklearnMeanShift',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Mean Shift Clustering',
    description: 'Mean shift clustering to find dense regions using scikit-learn',
    defaults: {
      name: 'Sklearn Mean Shift',
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
        displayName: 'Bandwidth',
        name: 'bandwidth',
        type: 'number',
        default: 0,
        description: 'Bandwidth (kernel size). Set to 0 for automatic estimation',
      },
      {
        displayName: 'Bin Seeding',
        name: 'binSeeding',
        type: 'boolean',
        default: false,
        description: 'Whether to use binning to speed up the algorithm',
      },
      {
        displayName: 'Min Bin Frequency',
        name: 'minBinFreq',
        type: 'number',
        displayOptions: {
          show: {
            binSeeding: [true],
          },
        },
        default: 1,
        description: 'Minimum number of points in a bin to seed it',
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
    const bandwidth = this.getNodeParameter('bandwidth', 0) as number;
    const binSeeding = this.getNodeParameter('binSeeding', 0) as boolean;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    let minBinFreq = 1;
    if (binSeeding) {
      minBinFreq = this.getNodeParameter('minBinFreq', 0) as number;
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
from sklearn.cluster import MeanShift, estimate_bandwidth

X = np.array(json.loads(sys.argv[1]))

bandwidth = ${bandwidth}
if bandwidth == 0:
    bandwidth = estimate_bandwidth(X, quantile=0.3)

clustering = MeanShift(
    bandwidth=bandwidth,
    bin_seeding=${binSeeding ? 'True' : 'False'},
    min_bin_freq=${minBinFreq}
)

labels = clustering.fit_predict(X)
cluster_centers = clustering.cluster_centers_

n_clusters = len(cluster_centers)

result = {
    'labels': labels.tolist(),
    'n_clusters': n_clusters,
    'cluster_centers': cluster_centers.tolist(),
    'bandwidth': float(bandwidth)
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
            bandwidth: result.bandwidth,
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnNMF implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn NMF',
    name: 'sklearnNMF',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} - {{$parameter["nComponents"]}} components',
    description: 'Non-negative Matrix Factorization for dimensionality reduction',
    defaults: {
      name: 'Sklearn NMF',
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
            name: 'Fit Transform',
            value: 'fitTransform',
            description: 'Fit NMF and transform data',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using fitted NMF',
            action: 'Transform',
          },
        ],
        default: 'fitTransform',
      },
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names (must be non-negative)',
        required: true,
      },
      {
        displayName: 'Number of Components',
        name: 'nComponents',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: 2,
        description: 'Number of components to extract',
      },
      {
        displayName: 'Initialization',
        name: 'init',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'NNDSVD', value: 'nndsvd' },
          { name: 'NNDSVDA', value: 'nndsvda' },
          { name: 'NNDSVDAR', value: 'nndsvdar' },
          { name: 'Random', value: 'random' },
        ],
        default: 'nndsvda',
        description: 'Method for initialization',
      },
      {
        displayName: 'Max Iterations',
        name: 'maxIter',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
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
            operation: ['fitTransform'],
          },
        },
        default: 42,
        description: 'Random seed for reproducibility',
      },
      {
        displayName: 'NMF Data',
        name: 'nmfData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted NMF',
        required: true,
      },
      {
        displayName: 'Feature Columns',
        name: 'transformFeatureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
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
      if (operation === 'fitTransform') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const nComponents = this.getNodeParameter('nComponents', 0) as number;
        const init = this.getNodeParameter('init', 0) as string;
        const maxIter = this.getNodeParameter('maxIter', 0) as number;
        const randomState = this.getNodeParameter('randomState', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

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
from sklearn.decomposition import NMF

X = np.array(json.loads(sys.argv[1]))

nmf = NMF(
    n_components=${nComponents},
    init='${init}',
    max_iter=${maxIter},
    random_state=${randomState}
)

transformed = nmf.fit_transform(X)

result = {
    'transformed': transformed.tolist(),
    'components': nmf.components_.tolist(),
    'reconstruction_err': float(nmf.reconstruction_err_),
    'n_iter': int(nmf.n_iter_),
    'n_components': ${nComponents},
    'feature_columns': ${JSON.stringify(featureColumns)}
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
          const newJson: any = { ...items[i].json };

          for (let j = 0; j < result.n_components; j++) {
            newJson[`nmf_component_${j + 1}`] = result.transformed[i][j];
          }

          if (i === 0) {
            newJson.nmf = resultData;
            newJson.reconstruction_error = result.reconstruction_err;
            newJson.n_iterations = result.n_iter;
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const nmfDataStr = this.getNodeParameter('nmfData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('transformFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const nmfInfo = JSON.parse(nmfDataStr);

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
from sklearn.decomposition import NMF

X = np.array(json.loads(sys.argv[1]))
nmf_data = json.loads(sys.argv[2])

nmf = NMF(n_components=nmf_data['n_components'])
nmf.components_ = np.array(nmf_data['components'])
nmf.n_components_ = nmf_data['n_components']

transformed = nmf.transform(X)

result = {
    'transformed': transformed.tolist()
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), nmfDataStr]);
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
          const newJson: any = { ...items[i].json };

          for (let j = 0; j < result.transformed[i].length; j++) {
            newJson[`nmf_component_${j + 1}`] = result.transformed[i][j];
          }

          returnData.push({ json: newJson });
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

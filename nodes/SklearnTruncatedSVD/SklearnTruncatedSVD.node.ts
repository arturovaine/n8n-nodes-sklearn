import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnTruncatedSVD implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Truncated SVD',
    name: 'sklearnTruncatedSVD',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} - {{$parameter["nComponents"]}} components',
    description: 'Dimensionality reduction using truncated SVD (LSA) for sparse data',
    defaults: {
      name: 'Sklearn Truncated SVD',
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
            description: 'Fit SVD and transform data',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using fitted SVD',
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
        description: 'Comma-separated list of feature column names',
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
        description: 'Number of components to keep',
      },
      {
        displayName: 'Algorithm',
        name: 'algorithm',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'Randomized', value: 'randomized' },
          { name: 'ARPACK', value: 'arpack' },
        ],
        default: 'randomized',
        description: 'SVD solver algorithm',
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
        displayName: 'SVD Data',
        name: 'svdData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted SVD',
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
        const algorithm = this.getNodeParameter('algorithm', 0) as string;
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
from sklearn.decomposition import TruncatedSVD

X = np.array(json.loads(sys.argv[1]))

svd = TruncatedSVD(
    n_components=${nComponents},
    algorithm='${algorithm}',
    random_state=${randomState}
)

transformed = svd.fit_transform(X)

result = {
    'transformed': transformed.tolist(),
    'explained_variance': svd.explained_variance_.tolist(),
    'explained_variance_ratio': svd.explained_variance_ratio_.tolist(),
    'singular_values': svd.singular_values_.tolist(),
    'components': svd.components_.tolist(),
    'n_components': ${nComponents},
    'total_variance_explained': float(sum(svd.explained_variance_ratio_)),
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
            newJson[`svd_component_${j + 1}`] = result.transformed[i][j];
          }

          if (i === 0) {
            newJson.svd = resultData;
            newJson.explained_variance_ratio = result.explained_variance_ratio;
            newJson.total_variance_explained = result.total_variance_explained;
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const svdDataStr = this.getNodeParameter('svdData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('transformFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const svdInfo = JSON.parse(svdDataStr);

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
from sklearn.decomposition import TruncatedSVD

X = np.array(json.loads(sys.argv[1]))
svd_data = json.loads(sys.argv[2])

svd = TruncatedSVD(n_components=svd_data['n_components'])
svd.components_ = np.array(svd_data['components'])
svd.explained_variance_ = np.array(svd_data['explained_variance'])
svd.explained_variance_ratio_ = np.array(svd_data['explained_variance_ratio'])
svd.singular_values_ = np.array(svd_data['singular_values'])

transformed = svd.transform(X)

result = {
    'transformed': transformed.tolist()
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), svdDataStr]);
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
            newJson[`svd_component_${j + 1}`] = result.transformed[i][j];
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

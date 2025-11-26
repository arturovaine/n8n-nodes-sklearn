import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnPCA implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn PCA',
    name: 'sklearnPCA',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Principal Component Analysis using scikit-learn',
    defaults: {
      name: 'Sklearn PCA',
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
            description: 'Fit PCA model and get components',
            action: 'Fit PCA model',
          },
          {
            name: 'Fit Transform',
            value: 'fitTransform',
            description: 'Fit PCA and transform data to principal components',
            action: 'Fit and transform data',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform data using a fitted PCA model',
            action: 'Transform data',
          },
          {
            name: 'Inverse Transform',
            value: 'inverseTransform',
            description: 'Reconstruct original features from principal components',
            action: 'Inverse transform data',
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
            operation: ['fit', 'fitTransform'],
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
            operation: ['fit', 'fitTransform'],
          },
        },
        default: 2,
        description: 'Number of principal components to keep. Set to 0 to keep all.',
      },
      {
        displayName: 'PCA Model Data',
        name: 'pcaData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform', 'inverseTransform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted PCA model',
        required: true,
      },
      {
        displayName: 'Input Columns',
        name: 'transformColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names (must match fitted features)',
        required: true,
      },
      {
        displayName: 'PC Columns',
        name: 'pcColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['inverseTransform'],
          },
        },
        default: '',
        placeholder: 'PC1,PC2',
        description: 'Comma-separated list of principal component column names',
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
      if (operation === 'fit' || operation === 'fitTransform') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const nComponents = this.getNodeParameter('nComponents', 0) as number;
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

        const nComp = nComponents === 0 ? 'None' : String(nComponents);

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.decomposition import PCA

data = json.loads(sys.argv[1])
X = np.array(data)

n_components = ${nComp}
if n_components is None or n_components > min(X.shape):
    n_components = min(X.shape)

pca = PCA(n_components=n_components)
pca.fit(X)

result = {
    'components': pca.components_.tolist(),
    'explained_variance': pca.explained_variance_.tolist(),
    'explained_variance_ratio': pca.explained_variance_ratio_.tolist(),
    'cumulative_variance_ratio': np.cumsum(pca.explained_variance_ratio_).tolist(),
    'mean': pca.mean_.tolist(),
    'n_components': int(pca.n_components_),
    'n_features': int(pca.n_features_in_),
    'feature_columns': ${JSON.stringify(featureColumns)}
}

${operation === 'fitTransform' ? "result['transformed'] = pca.transform(X).tolist()" : ''}

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

        if (operation === 'fit') {
          returnData.push({
            json: {
              pca_model: resultData,
              n_components: result.n_components,
              explained_variance_ratio: result.explained_variance_ratio,
              cumulative_variance_ratio: result.cumulative_variance_ratio,
              feature_columns: result.feature_columns,
              fitted_samples: items.length,
            },
          });
        } else {
          for (let i = 0; i < items.length; i++) {
            const newJson: any = { ...items[i].json };
            for (let j = 0; j < result.n_components; j++) {
              newJson[`PC${j + 1}`] = result.transformed[i][j];
            }
            if (i === 0) {
              newJson.pca_model = resultData;
              newJson.explained_variance_ratio = result.explained_variance_ratio;
              newJson.cumulative_variance_ratio = result.cumulative_variance_ratio;
            }
            returnData.push({ json: newJson });
          }
        }

      } else if (operation === 'transform') {
        const pcaDataStr = this.getNodeParameter('pcaData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('transformColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const pcaData = JSON.parse(pcaDataStr);

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
from sklearn.decomposition import PCA

pca_data = json.loads(sys.argv[1])
data = json.loads(sys.argv[2])
X = np.array(data)

pca = PCA(n_components=pca_data['n_components'])
pca.components_ = np.array(pca_data['components'])
pca.mean_ = np.array(pca_data['mean'])
pca.explained_variance_ = np.array(pca_data['explained_variance'])
pca.n_features_in_ = pca_data['n_features']

transformed = pca.transform(X)

print(json.dumps({'transformed': transformed.tolist()}))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, pcaDataStr, JSON.stringify(data)]);
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
          for (let j = 0; j < pcaData.n_components; j++) {
            newJson[`PC${j + 1}`] = result.transformed[i][j];
          }
          returnData.push({ json: newJson });
        }

      } else if (operation === 'inverseTransform') {
        const pcaDataStr = this.getNodeParameter('pcaData', 0) as string;
        const pcColumnsStr = this.getNodeParameter('pcColumns', 0) as string;
        const pcColumns = pcColumnsStr.split(',').map((col) => col.trim());
        const pcaData = JSON.parse(pcaDataStr);

        const data = items.map((item, idx) => {
          return pcColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.decomposition import PCA

pca_data = json.loads(sys.argv[1])
data = json.loads(sys.argv[2])
X = np.array(data)

pca = PCA(n_components=pca_data['n_components'])
pca.components_ = np.array(pca_data['components'])
pca.mean_ = np.array(pca_data['mean'])
pca.n_features_in_ = pca_data['n_features']

reconstructed = pca.inverse_transform(X)

print(json.dumps({'reconstructed': reconstructed.tolist()}))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, pcaDataStr, JSON.stringify(data)]);
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
        const featureColumns = pcaData.feature_columns;

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };
          featureColumns.forEach((col: string, idx: number) => {
            newJson[`reconstructed_${col}`] = result.reconstructed[i][idx];
          });
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnStandardScaler implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Standard Scaler',
    name: 'sklearnStandardScaler',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Standardize features using scikit-learn StandardScaler',
    defaults: {
      name: 'Sklearn Standard Scaler',
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
            description: 'Compute mean and std to be used for scaling',
            action: 'Fit the scaler to data',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Perform standardization using a fitted scaler',
            action: 'Transform data using fitted scaler',
          },
          {
            name: 'Fit Transform',
            value: 'fitTransform',
            description: 'Fit to data, then transform it',
            action: 'Fit and transform data',
          },
        ],
        default: 'fitTransform',
      },
      // Fit and Fit Transform parameters
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
        description: 'Comma-separated list of feature column names to scale',
        required: true,
      },
      {
        displayName: 'With Mean',
        name: 'withMean',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fit', 'fitTransform'],
          },
        },
        default: true,
        description: 'Whether to center the data before scaling',
      },
      {
        displayName: 'With Std',
        name: 'withStd',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fit', 'fitTransform'],
          },
        },
        default: true,
        description: 'Whether to scale the data to unit variance',
      },
      // Transform operation parameters
      {
        displayName: 'Scaler Data',
        name: 'scalerData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted scaler (from fit operation)',
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
        description: 'Comma-separated list of feature column names (must match fitted columns)',
        required: true,
      },
      {
        displayName: 'Output Prefix',
        name: 'outputPrefix',
        type: 'string',
        default: 'scaled_',
        description: 'Prefix to add to scaled column names',
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
    const outputPrefix = this.getNodeParameter('outputPrefix', 0) as string;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        if (operation === 'fit' || operation === 'fitTransform') {
          const featureColumnsStr = this.getNodeParameter('featureColumns', itemIndex) as string;
          const withMean = this.getNodeParameter('withMean', itemIndex) as boolean;
          const withStd = this.getNodeParameter('withStd', itemIndex) as boolean;

          const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

          // Extract data from all items
          const data = items.map((item) => {
            const features = featureColumns.map((col) => {
              const value = item.json[col];
              if (value === undefined || value === null) {
                throw new NodeOperationError(
                  this.getNode(),
                  `Feature column '${col}' not found in item`,
                  { itemIndex }
                );
              }
              return parseFloat(String(value));
            });
            return features;
          });

          // Create Python script
          const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import StandardScaler

# Read input data
data = json.loads(sys.argv[1])
X = np.array(data)

# Fit scaler
scaler = StandardScaler(with_mean=${withMean ? 'True' : 'False'}, with_std=${withStd ? 'True' : 'False'})
scaler.fit(X)

result = {
    'mean': scaler.mean_.tolist() if hasattr(scaler, 'mean_') else None,
    'scale': scaler.scale_.tolist() if hasattr(scaler, 'scale_') else None,
    'var': scaler.var_.tolist() if hasattr(scaler, 'var_') else None,
    'feature_columns': ${JSON.stringify(featureColumns)},
    'with_mean': ${withMean ? 'True' : 'False'},
    'with_std': ${withStd ? 'True' : 'False'}
}

${operation === 'fitTransform' ? "result['transformed'] = scaler.transform(X).tolist()" : ''}

print(json.dumps(result))
`;

          const { spawn } = require('child_process');
          const resultData = await new Promise<string>((resolve, reject) => {
            const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data)]);
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

          if (operation === 'fit') {
            returnData.push({
              json: {
                scaler: resultData,
                mean: result.mean,
                scale: result.scale,
                variance: result.var,
                feature_columns: result.feature_columns,
                fitted_samples: items.length,
              },
            });
          } else {
            // fitTransform - return transformed data with original data
            for (let i = 0; i < items.length; i++) {
              const transformedFeatures = result.transformed[i];
              const newJson: any = { ...items[i].json };

              // Add scaled features with prefix
              featureColumns.forEach((col, idx) => {
                newJson[`${outputPrefix}${col}`] = transformedFeatures[idx];
              });

              // Add scaler info only to first item
              if (i === 0) {
                newJson.scaler = resultData;
                newJson.scaler_info = {
                  mean: result.mean,
                  scale: result.scale,
                  variance: result.var,
                };
              }

              returnData.push({ json: newJson });
            }
          }
        } else if (operation === 'transform') {
          const scalerDataStr = this.getNodeParameter('scalerData', itemIndex) as string;
          const featureColumnsStr = this.getNodeParameter('transformFeatureColumns', itemIndex) as string;

          const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
          const scalerData = JSON.parse(scalerDataStr);

          // Extract data from all items
          const data = items.map((item) => {
            const features = featureColumns.map((col) => {
              const value = item.json[col];
              if (value === undefined || value === null) {
                throw new NodeOperationError(
                  this.getNode(),
                  `Feature column '${col}' not found in item`,
                  { itemIndex }
                );
              }
              return parseFloat(String(value));
            });
            return features;
          });

          // Create Python script for transform
          const pythonScript = `
import json
import sys
import numpy as np

# Read scaler and input data
scaler_data = json.loads(sys.argv[1])
data = json.loads(sys.argv[2])
X = np.array(data)

# Transform using stored parameters
mean = np.array(scaler_data['mean']) if scaler_data['mean'] else 0
scale = np.array(scaler_data['scale']) if scaler_data['scale'] else 1

if scaler_data['with_mean'] and scaler_data['with_std']:
    X_transformed = (X - mean) / scale
elif scaler_data['with_mean']:
    X_transformed = X - mean
elif scaler_data['with_std']:
    X_transformed = X / scale
else:
    X_transformed = X

result = {
    'transformed': X_transformed.tolist()
}

print(json.dumps(result))
`;

          const { spawn } = require('child_process');
          const resultData = await new Promise<string>((resolve, reject) => {
            const python = spawn(pythonPath, [
              '-c',
              pythonScript,
              scalerDataStr,
              JSON.stringify(data),
            ]);
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

          // Return transformed data with original data
          for (let i = 0; i < items.length; i++) {
            const transformedFeatures = result.transformed[i];
            const newJson: any = { ...items[i].json };

            // Add scaled features with prefix
            featureColumns.forEach((col, idx) => {
              newJson[`${outputPrefix}${col}`] = transformedFeatures[idx];
            });

            returnData.push({ json: newJson });
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnMinMaxScaler implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn MinMax Scaler',
    name: 'sklearnMinMaxScaler',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Scale features to a given range using scikit-learn MinMaxScaler',
    defaults: {
      name: 'Sklearn MinMax Scaler',
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
            description: 'Compute min and max to be used for scaling',
            action: 'Fit the scaler to data',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Scale features using a fitted scaler',
            action: 'Transform data using fitted scaler',
          },
          {
            name: 'Fit Transform',
            value: 'fitTransform',
            description: 'Fit to data, then transform it',
            action: 'Fit and transform data',
          },
          {
            name: 'Inverse Transform',
            value: 'inverseTransform',
            description: 'Undo the scaling transformation',
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
        description: 'Comma-separated list of feature column names to scale',
        required: true,
      },
      {
        displayName: 'Feature Range Min',
        name: 'featureRangeMin',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitTransform'],
          },
        },
        default: 0,
        description: 'Desired minimum value of transformed data',
      },
      {
        displayName: 'Feature Range Max',
        name: 'featureRangeMax',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fit', 'fitTransform'],
          },
        },
        default: 1,
        description: 'Desired maximum value of transformed data',
      },
      {
        displayName: 'Scaler Data',
        name: 'scalerData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform', 'inverseTransform'],
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
            operation: ['transform', 'inverseTransform'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names',
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

    try {
      if (operation === 'fit' || operation === 'fitTransform') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const featureRangeMin = this.getNodeParameter('featureRangeMin', 0) as number;
        const featureRangeMax = this.getNodeParameter('featureRangeMax', 0) as number;
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
from sklearn.preprocessing import MinMaxScaler

data = json.loads(sys.argv[1])
X = np.array(data)

scaler = MinMaxScaler(feature_range=(${featureRangeMin}, ${featureRangeMax}))
scaler.fit(X)

result = {
    'data_min': scaler.data_min_.tolist(),
    'data_max': scaler.data_max_.tolist(),
    'data_range': scaler.data_range_.tolist(),
    'scale': scaler.scale_.tolist(),
    'min': scaler.min_.tolist(),
    'feature_range': [${featureRangeMin}, ${featureRangeMax}],
    'feature_columns': ${JSON.stringify(featureColumns)}
}

${operation === 'fitTransform' ? "result['transformed'] = scaler.transform(X).tolist()" : ''}

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
              scaler: resultData,
              data_min: result.data_min,
              data_max: result.data_max,
              data_range: result.data_range,
              feature_range: result.feature_range,
              feature_columns: result.feature_columns,
              fitted_samples: items.length,
            },
          });
        } else {
          for (let i = 0; i < items.length; i++) {
            const newJson: any = { ...items[i].json };
            featureColumns.forEach((col, idx) => {
              newJson[`${outputPrefix}${col}`] = result.transformed[i][idx];
            });
            if (i === 0) {
              newJson.scaler = resultData;
            }
            returnData.push({ json: newJson });
          }
        }

      } else if (operation === 'transform' || operation === 'inverseTransform') {
        const scalerDataStr = this.getNodeParameter('scalerData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('transformFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const scalerData = JSON.parse(scalerDataStr);

        const data = items.map((item, idx) => {
          return featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const transformMethod = operation === 'inverseTransform' ? 'inverse_transform' : 'transform';

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import MinMaxScaler

scaler_data = json.loads(sys.argv[1])
data = json.loads(sys.argv[2])
X = np.array(data)

scaler = MinMaxScaler(feature_range=tuple(scaler_data['feature_range']))
scaler.data_min_ = np.array(scaler_data['data_min'])
scaler.data_max_ = np.array(scaler_data['data_max'])
scaler.data_range_ = np.array(scaler_data['data_range'])
scaler.scale_ = np.array(scaler_data['scale'])
scaler.min_ = np.array(scaler_data['min'])
scaler.n_features_in_ = len(scaler_data['feature_columns'])

result = {'transformed': scaler.${transformMethod}(X).tolist()}
print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, scalerDataStr, JSON.stringify(data)]);
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
        const prefix = operation === 'inverseTransform' ? 'original_' : outputPrefix;

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };
          featureColumns.forEach((col, idx) => {
            newJson[`${prefix}${col}`] = result.transformed[i][idx];
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

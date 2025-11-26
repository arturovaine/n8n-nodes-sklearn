import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnRobustScaler implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Robust Scaler',
    name: 'sklearnRobustScaler',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Scale features using statistics robust to outliers (median and IQR)',
    defaults: {
      name: 'Sklearn Robust Scaler',
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
            description: 'Fit scaler and transform data',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using a fitted scaler',
            action: 'Transform',
          },
          {
            name: 'Inverse Transform',
            value: 'inverseTransform',
            description: 'Reverse the scaling',
            action: 'Inverse transform',
          },
        ],
        default: 'fitTransform',
      },
      {
        displayName: 'Columns',
        name: 'columns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: '',
        placeholder: 'col1,col2,col3',
        description: 'Comma-separated list of columns to scale',
        required: true,
      },
      {
        displayName: 'With Centering',
        name: 'withCentering',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: true,
        description: 'Whether to center the data before scaling (subtract median)',
      },
      {
        displayName: 'With Scaling',
        name: 'withScaling',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: true,
        description: 'Whether to scale data to IQR',
      },
      {
        displayName: 'Quantile Range',
        name: 'quantileRange',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'IQR (25-75)', value: '25-75' },
          { name: '10-90', value: '10-90' },
          { name: '5-95', value: '5-95' },
        ],
        default: '25-75',
        description: 'Quantile range used for scaling',
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
        description: 'JSON string containing the fitted scaler',
        required: true,
      },
      {
        displayName: 'Columns',
        name: 'transformColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform', 'inverseTransform'],
          },
        },
        default: '',
        placeholder: 'col1,col2,col3',
        description: 'Comma-separated list of columns to transform',
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
        const columnsStr = this.getNodeParameter('columns', 0) as string;
        const withCentering = this.getNodeParameter('withCentering', 0) as boolean;
        const withScaling = this.getNodeParameter('withScaling', 0) as boolean;
        const quantileRange = this.getNodeParameter('quantileRange', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());

        const [qMin, qMax] = quantileRange.split('-').map(Number);

        const data = items.map((item, idx) => {
          return columns.map((col) => {
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
from sklearn.preprocessing import RobustScaler

X = np.array(json.loads(sys.argv[1]))

scaler = RobustScaler(
    with_centering=${withCentering ? 'True' : 'False'},
    with_scaling=${withScaling ? 'True' : 'False'},
    quantile_range=(${qMin}, ${qMax})
)

scaled = scaler.fit_transform(X)

result = {
    'scaled': scaled.tolist(),
    'center': scaler.center_.tolist() if scaler.center_ is not None else None,
    'scale': scaler.scale_.tolist() if scaler.scale_ is not None else None,
    'columns': ${JSON.stringify(columns)},
    'with_centering': ${withCentering ? 'True' : 'False'},
    'with_scaling': ${withScaling ? 'True' : 'False'},
    'quantile_range': [${qMin}, ${qMax}]
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

          columns.forEach((col, idx) => {
            newJson[`${col}_scaled`] = result.scaled[i][idx];
          });

          if (i === 0) {
            newJson.scaler = resultData;
            if (result.center) {
              newJson.center = Object.fromEntries(columns.map((col, idx) => [col, result.center[idx]]));
            }
            if (result.scale) {
              newJson.scale = Object.fromEntries(columns.map((col, idx) => [col, result.scale[idx]]));
            }
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform' || operation === 'inverseTransform') {
        const scalerDataStr = this.getNodeParameter('scalerData', 0) as string;
        const columnsStr = this.getNodeParameter('transformColumns', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());
        const scalerInfo = JSON.parse(scalerDataStr);

        const data = items.map((item, idx) => {
          return columns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const transformMethod = operation === 'inverseTransform' ? 'inverse_transform' : 'transform';

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import RobustScaler

X = np.array(json.loads(sys.argv[1]))
scaler_data = json.loads(sys.argv[2])

scaler = RobustScaler(
    with_centering=scaler_data['with_centering'],
    with_scaling=scaler_data['with_scaling'],
    quantile_range=tuple(scaler_data['quantile_range'])
)

# Manually set fitted parameters
if scaler_data['center'] is not None:
    scaler.center_ = np.array(scaler_data['center'])
if scaler_data['scale'] is not None:
    scaler.scale_ = np.array(scaler_data['scale'])

result_data = scaler.${transformMethod}(X)

result = {
    'transformed': result_data.tolist()
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), scalerDataStr]);
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
        const suffix = operation === 'inverseTransform' ? '_original' : '_scaled';

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };

          columns.forEach((col, idx) => {
            newJson[`${col}${suffix}`] = result.transformed[i][idx];
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

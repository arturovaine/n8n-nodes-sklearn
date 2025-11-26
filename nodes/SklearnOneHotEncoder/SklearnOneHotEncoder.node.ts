import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnOneHotEncoder implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn One Hot Encoder',
    name: 'sklearnOneHotEncoder',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'One-hot encode categorical features using scikit-learn',
    defaults: {
      name: 'Sklearn One Hot Encoder',
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
            description: 'Fit encoder and transform categorical columns',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using a fitted encoder',
            action: 'Transform',
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
        placeholder: 'color,size,category',
        description: 'Comma-separated list of categorical columns to encode',
        required: true,
      },
      {
        displayName: 'Drop First',
        name: 'dropFirst',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: false,
        description: 'Whether to drop the first category to avoid multicollinearity',
      },
      {
        displayName: 'Handle Unknown',
        name: 'handleUnknown',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'Error', value: 'error', description: 'Raise an error on unknown categories' },
          { name: 'Ignore', value: 'ignore', description: 'Ignore unknown categories (all zeros)' },
        ],
        default: 'error',
        description: 'How to handle unknown categories during transform',
      },
      {
        displayName: 'Encoder Data',
        name: 'encoderData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted encoder',
        required: true,
      },
      {
        displayName: 'Columns',
        name: 'transformColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        placeholder: 'color,size,category',
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
        const dropFirst = this.getNodeParameter('dropFirst', 0) as boolean;
        const handleUnknown = this.getNodeParameter('handleUnknown', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());

        const data = items.map((item, idx) => {
          const row: Record<string, any> = {};
          columns.forEach((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Column '${col}' not found`, { itemIndex: idx });
            }
            row[col] = String(value);
          });
          return row;
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import OneHotEncoder

data = json.loads(sys.argv[1])
columns = ${JSON.stringify(columns)}

# Build array for each column
X = np.array([[row[col] for col in columns] for row in data])

encoder = OneHotEncoder(
    drop='first' if ${dropFirst ? 'True' : 'False'} else None,
    handle_unknown='${handleUnknown}',
    sparse_output=False
)

encoded = encoder.fit_transform(X)

# Get feature names
feature_names = encoder.get_feature_names_out(columns).tolist()

# Store categories for each column
categories = {}
for i, col in enumerate(columns):
    categories[col] = encoder.categories_[i].tolist()

result = {
    'encoded': encoded.tolist(),
    'feature_names': feature_names,
    'categories': categories,
    'columns': columns,
    'drop_first': ${dropFirst ? 'True' : 'False'},
    'handle_unknown': '${handleUnknown}'
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

          // Add one-hot encoded columns
          result.feature_names.forEach((name: string, idx: number) => {
            newJson[name] = result.encoded[i][idx];
          });

          // Add encoder info to first item
          if (i === 0) {
            newJson.encoder = resultData;
            newJson.encoded_columns = result.feature_names;
            newJson.categories = result.categories;
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const encoderDataStr = this.getNodeParameter('encoderData', 0) as string;
        const columnsStr = this.getNodeParameter('transformColumns', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());
        const encoderInfo = JSON.parse(encoderDataStr);

        const data = items.map((item, idx) => {
          const row: Record<string, any> = {};
          columns.forEach((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Column '${col}' not found`, { itemIndex: idx });
            }
            row[col] = String(value);
          });
          return row;
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import OneHotEncoder

data = json.loads(sys.argv[1])
encoder_data = json.loads(sys.argv[2])
columns = encoder_data['columns']

X = np.array([[row[col] for col in columns] for row in data])

# Reconstruct encoder
encoder = OneHotEncoder(
    drop='first' if encoder_data['drop_first'] else None,
    handle_unknown=encoder_data['handle_unknown'],
    sparse_output=False
)

# Set categories from saved data
encoder.fit([list(encoder_data['categories'][col]) for col in columns])

encoded = encoder.transform(X)
feature_names = encoder.get_feature_names_out(columns).tolist()

result = {
    'encoded': encoded.tolist(),
    'feature_names': feature_names
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), encoderDataStr]);
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

          result.feature_names.forEach((name: string, idx: number) => {
            newJson[name] = result.encoded[i][idx];
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

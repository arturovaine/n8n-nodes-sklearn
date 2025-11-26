import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnLabelEncoder implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Label Encoder',
    name: 'sklearnLabelEncoder',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Encode categorical labels as integers using scikit-learn',
    defaults: {
      name: 'Sklearn Label Encoder',
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
            description: 'Fit encoder and transform labels to integers',
            action: 'Fit and transform labels',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform labels using a fitted encoder',
            action: 'Transform labels',
          },
          {
            name: 'Inverse Transform',
            value: 'inverseTransform',
            description: 'Convert integers back to original labels',
            action: 'Inverse transform labels',
          },
        ],
        default: 'fitTransform',
      },
      {
        displayName: 'Column',
        name: 'column',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: '',
        placeholder: 'category',
        description: 'Column containing categorical labels to encode',
        required: true,
      },
      {
        displayName: 'Encoder Data',
        name: 'encoderData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform', 'inverseTransform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted encoder (from fit transform operation)',
        required: true,
      },
      {
        displayName: 'Column',
        name: 'transformColumn',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform', 'inverseTransform'],
          },
        },
        default: '',
        placeholder: 'category',
        description: 'Column to transform',
        required: true,
      },
      {
        displayName: 'Output Column',
        name: 'outputColumn',
        type: 'string',
        default: '',
        placeholder: 'category_encoded',
        description: 'Name for the output column. Leave empty to use original column name with suffix.',
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
    const outputColumn = this.getNodeParameter('outputColumn', 0) as string;

    try {
      if (operation === 'fitTransform') {
        const column = this.getNodeParameter('column', 0) as string;

        const labels = items.map((item, idx) => {
          const value = item.json[column];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${column}' not found`, { itemIndex: idx });
          }
          return String(value);
        });

        const pythonScript = `
import json
import sys
from sklearn.preprocessing import LabelEncoder

labels = json.loads(sys.argv[1])

encoder = LabelEncoder()
encoded = encoder.fit_transform(labels)

result = {
    'classes': encoder.classes_.tolist(),
    'encoded': encoded.tolist(),
    'column': '${column}'
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(labels)]);
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
        const outCol = outputColumn || `${column}_encoded`;

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };
          newJson[outCol] = result.encoded[i];
          if (i === 0) {
            newJson.encoder = resultData;
            newJson.label_mapping = {};
            result.classes.forEach((cls: string, idx: number) => {
              newJson.label_mapping[cls] = idx;
            });
          }
          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const encoderDataStr = this.getNodeParameter('encoderData', 0) as string;
        const column = this.getNodeParameter('transformColumn', 0) as string;
        const encoderData = JSON.parse(encoderDataStr);

        const labels = items.map((item, idx) => {
          const value = item.json[column];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${column}' not found`, { itemIndex: idx });
          }
          return String(value);
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import LabelEncoder

encoder_data = json.loads(sys.argv[1])
labels = json.loads(sys.argv[2])

encoder = LabelEncoder()
encoder.classes_ = np.array(encoder_data['classes'])

encoded = encoder.transform(labels)

print(json.dumps({'encoded': encoded.tolist()}))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, encoderDataStr, JSON.stringify(labels)]);
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
        const outCol = outputColumn || `${column}_encoded`;

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };
          newJson[outCol] = result.encoded[i];
          returnData.push({ json: newJson });
        }

      } else if (operation === 'inverseTransform') {
        const encoderDataStr = this.getNodeParameter('encoderData', 0) as string;
        const column = this.getNodeParameter('transformColumn', 0) as string;
        const encoderData = JSON.parse(encoderDataStr);

        const encoded = items.map((item, idx) => {
          const value = item.json[column];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${column}' not found`, { itemIndex: idx });
          }
          return parseInt(String(value));
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.preprocessing import LabelEncoder

encoder_data = json.loads(sys.argv[1])
encoded = json.loads(sys.argv[2])

encoder = LabelEncoder()
encoder.classes_ = np.array(encoder_data['classes'])

labels = encoder.inverse_transform(encoded)

print(json.dumps({'labels': labels.tolist()}))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, encoderDataStr, JSON.stringify(encoded)]);
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
        const outCol = outputColumn || `${column}_decoded`;

        for (let i = 0; i < items.length; i++) {
          const newJson: any = { ...items[i].json };
          newJson[outCol] = result.labels[i];
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

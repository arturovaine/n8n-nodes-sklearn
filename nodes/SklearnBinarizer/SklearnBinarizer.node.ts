import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnBinarizer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Binarizer',
    name: 'sklearnBinarizer',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Threshold: {{$parameter["threshold"]}}',
    description: 'Binarize data (set feature values to 0 or 1) using scikit-learn',
    defaults: {
      name: 'Sklearn Binarizer',
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
        displayName: 'Threshold',
        name: 'threshold',
        type: 'number',
        default: 0.0,
        description: 'Values <= threshold become 0, values > threshold become 1',
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
    const threshold = this.getNodeParameter('threshold', 0) as number;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

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
from sklearn.preprocessing import Binarizer

X = np.array(json.loads(sys.argv[1]))

binarizer = Binarizer(threshold=${threshold})
binarized = binarizer.fit_transform(X)

result = {
    'binarized': binarized.tolist(),
    'threshold': ${threshold}
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

        featureColumns.forEach((col, idx) => {
          newJson[`${col}_binary`] = result.binarized[i][idx];
        });

        returnData.push({ json: newJson });
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnNormalizer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Normalizer',
    name: 'sklearnNormalizer',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["norm"]}} normalization',
    description: 'Normalize samples individually to unit norm using scikit-learn',
    defaults: {
      name: 'Sklearn Normalizer',
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
        displayName: 'Norm',
        name: 'norm',
        type: 'options',
        options: [
          { name: 'L2 (Euclidean)', value: 'l2', description: 'Sum of squares equals 1' },
          { name: 'L1 (Manhattan)', value: 'l1', description: 'Sum of absolute values equals 1' },
          { name: 'Max', value: 'max', description: 'Maximum absolute value equals 1' },
        ],
        default: 'l2',
        description: 'Norm to use for normalization',
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
    const norm = this.getNodeParameter('norm', 0) as string;
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
from sklearn.preprocessing import Normalizer

X = np.array(json.loads(sys.argv[1]))

normalizer = Normalizer(norm='${norm}')
normalized = normalizer.fit_transform(X)

result = {
    'normalized': normalized.tolist(),
    'norm': '${norm}'
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
          newJson[`${col}_normalized`] = result.normalized[i][idx];
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

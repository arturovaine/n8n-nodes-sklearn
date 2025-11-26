import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class SklearnTrainTestSplit implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Train Test Split',
    name: 'sklearnTrainTestSplit',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Split {{$parameter["testSize"] * 100}}% test',
    description: 'Split data into training and test sets using scikit-learn',
    defaults: {
      name: 'Sklearn Train Test Split',
    },
    inputs: ['main'],
    outputs: ['main', 'main'],
    outputNames: ['Train', 'Test'],
    properties: [
      {
        displayName: 'Test Size',
        name: 'testSize',
        type: 'number',
        default: 0.2,
        description: 'Proportion of data for test set (0.0 to 1.0)',
        typeOptions: {
          minValue: 0.01,
          maxValue: 0.99,
          numberPrecision: 2,
        },
      },
      {
        displayName: 'Shuffle',
        name: 'shuffle',
        type: 'boolean',
        default: true,
        description: 'Whether to shuffle data before splitting',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        default: 42,
        description: 'Random seed for reproducibility (only used when shuffle is true)',
        displayOptions: {
          show: {
            shuffle: [true],
          },
        },
      },
      {
        displayName: 'Stratify Column',
        name: 'stratifyColumn',
        type: 'string',
        default: '',
        placeholder: 'target',
        description: 'Column to use for stratified splitting (preserves class proportions). Leave empty to disable.',
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
    const testSize = this.getNodeParameter('testSize', 0) as number;
    const shuffle = this.getNodeParameter('shuffle', 0) as boolean;
    const stratifyColumn = this.getNodeParameter('stratifyColumn', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    let randomState = 42;
    if (shuffle) {
      randomState = this.getNodeParameter('randomState', 0) as number;
    }

    const data = items.map((item) => item.json);

    // Get stratify values if specified
    let stratifyValues: any[] | null = null;
    if (stratifyColumn && stratifyColumn.trim() !== '') {
      stratifyValues = items.map((item) => item.json[stratifyColumn]);
    }

    const pythonScript = `
import json
import sys
from sklearn.model_selection import train_test_split

data = json.loads(sys.argv[1])
test_size = float(sys.argv[2])
shuffle = sys.argv[3] == 'true'
random_state = int(sys.argv[4]) if shuffle else None
stratify_values = json.loads(sys.argv[5]) if sys.argv[5] != 'null' else None

indices = list(range(len(data)))

if stratify_values:
    train_idx, test_idx = train_test_split(
        indices,
        test_size=test_size,
        shuffle=shuffle,
        random_state=random_state,
        stratify=stratify_values
    )
else:
    train_idx, test_idx = train_test_split(
        indices,
        test_size=test_size,
        shuffle=shuffle,
        random_state=random_state
    )

result = {
    'train_indices': train_idx,
    'test_indices': test_idx
}

print(json.dumps(result))
`;

    const { spawn } = require('child_process');
    const splitData = await new Promise<string>((resolve, reject) => {
      const python = spawn(pythonPath, [
        '-c',
        pythonScript,
        JSON.stringify(data),
        String(testSize),
        String(shuffle),
        String(randomState),
        stratifyValues ? JSON.stringify(stratifyValues) : 'null',
      ]);
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
      python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

      python.on('close', (code: number) => {
        if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
        else resolve(output.trim());
      });
    });

    const result = JSON.parse(splitData);

    const trainData: INodeExecutionData[] = result.train_indices.map((idx: number) => ({
      json: { ...items[idx].json, _split: 'train' },
    }));

    const testData: INodeExecutionData[] = result.test_indices.map((idx: number) => ({
      json: { ...items[idx].json, _split: 'test' },
    }));

    return [trainData, testData];
  }
}

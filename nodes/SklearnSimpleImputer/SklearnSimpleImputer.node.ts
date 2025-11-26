import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnSimpleImputer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Simple Imputer',
    name: 'sklearnSimpleImputer',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} - {{$parameter["strategy"]}}',
    description: 'Handle missing values using scikit-learn SimpleImputer',
    defaults: {
      name: 'Sklearn Simple Imputer',
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
            description: 'Fit imputer and transform data',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using a fitted imputer',
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
        placeholder: 'col1,col2,col3',
        description: 'Comma-separated list of columns to impute',
        required: true,
      },
      {
        displayName: 'Strategy',
        name: 'strategy',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'Mean', value: 'mean', description: 'Replace with mean (numeric only)' },
          { name: 'Median', value: 'median', description: 'Replace with median (numeric only)' },
          { name: 'Most Frequent', value: 'most_frequent', description: 'Replace with mode' },
          { name: 'Constant', value: 'constant', description: 'Replace with a constant value' },
        ],
        default: 'mean',
        description: 'Imputation strategy',
      },
      {
        displayName: 'Fill Value',
        name: 'fillValue',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
            strategy: ['constant'],
          },
        },
        default: '0',
        description: 'Value to use for constant strategy',
      },
      {
        displayName: 'Imputer Data',
        name: 'imputerData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted imputer',
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
        const strategy = this.getNodeParameter('strategy', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());

        let fillValue = '0';
        if (strategy === 'constant') {
          fillValue = this.getNodeParameter('fillValue', 0) as string;
        }

        const data = items.map((item, idx) => {
          const row: Record<string, any> = {};
          columns.forEach((col) => {
            const value = item.json[col];
            row[col] = value === undefined || value === null || value === '' ? null : value;
          });
          return row;
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.impute import SimpleImputer

data = json.loads(sys.argv[1])
columns = ${JSON.stringify(columns)}
strategy = '${strategy}'
fill_value = ${strategy === 'constant' ? `'${fillValue}'` : 'None'}

# Build array
X = []
for row in data:
    X.append([row[col] for col in columns])

X = np.array(X, dtype=float if strategy in ['mean', 'median'] else object)

imputer = SimpleImputer(
    strategy=strategy,
    fill_value=float(fill_value) if strategy == 'constant' and fill_value.replace('.','').replace('-','').isdigit() else fill_value
)

imputed = imputer.fit_transform(X)

result = {
    'imputed': imputed.tolist(),
    'statistics': imputer.statistics_.tolist(),
    'columns': columns,
    'strategy': strategy,
    'fill_value': fill_value
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
            newJson[col] = result.imputed[i][idx];
          });

          if (i === 0) {
            newJson.imputer = resultData;
            newJson.statistics = Object.fromEntries(
              columns.map((col, idx) => [col, result.statistics[idx]])
            );
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const imputerDataStr = this.getNodeParameter('imputerData', 0) as string;
        const columnsStr = this.getNodeParameter('transformColumns', 0) as string;
        const columns = columnsStr.split(',').map((col) => col.trim());
        const imputerInfo = JSON.parse(imputerDataStr);

        const data = items.map((item) => {
          const row: Record<string, any> = {};
          columns.forEach((col) => {
            const value = item.json[col];
            row[col] = value === undefined || value === null || value === '' ? null : value;
          });
          return row;
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.impute import SimpleImputer

data = json.loads(sys.argv[1])
imputer_data = json.loads(sys.argv[2])
columns = imputer_data['columns']
strategy = imputer_data['strategy']
fill_value = imputer_data['fill_value']

X = []
for row in data:
    X.append([row[col] for col in columns])

X = np.array(X, dtype=float if strategy in ['mean', 'median'] else object)

imputer = SimpleImputer(
    strategy=strategy,
    fill_value=float(fill_value) if strategy == 'constant' and str(fill_value).replace('.','').replace('-','').isdigit() else fill_value
)

# Manually set statistics
imputer.fit([[0]*len(columns)])  # Dummy fit
imputer.statistics_ = np.array(imputer_data['statistics'])

imputed = imputer.transform(X)

result = {
    'imputed': imputed.tolist()
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), imputerDataStr]);
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
            newJson[col] = result.imputed[i][idx];
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

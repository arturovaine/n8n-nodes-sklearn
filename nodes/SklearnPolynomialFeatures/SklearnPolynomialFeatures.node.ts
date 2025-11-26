import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnPolynomialFeatures implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Polynomial Features',
    name: 'sklearnPolynomialFeatures',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Degree {{$parameter["degree"]}}',
    description: 'Generate polynomial and interaction features using scikit-learn',
    defaults: {
      name: 'Sklearn Polynomial Features',
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
            description: 'Fit and generate polynomial features',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using fitted transformer',
            action: 'Transform',
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
            operation: ['fitTransform'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2',
        description: 'Comma-separated list of feature column names',
        required: true,
      },
      {
        displayName: 'Degree',
        name: 'degree',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: 2,
        description: 'Degree of polynomial features',
      },
      {
        displayName: 'Include Bias',
        name: 'includeBias',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: true,
        description: 'Whether to include a bias column (all ones)',
      },
      {
        displayName: 'Interaction Only',
        name: 'interactionOnly',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: false,
        description: 'Whether to produce only interaction features (no powers)',
      },
      {
        displayName: 'Transformer Data',
        name: 'transformerData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted transformer',
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
        placeholder: 'feature1,feature2',
        description: 'Comma-separated list of feature column names',
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
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const degree = this.getNodeParameter('degree', 0) as number;
        const includeBias = this.getNodeParameter('includeBias', 0) as boolean;
        const interactionOnly = this.getNodeParameter('interactionOnly', 0) as boolean;

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
from sklearn.preprocessing import PolynomialFeatures

X = np.array(json.loads(sys.argv[1]))

poly = PolynomialFeatures(
    degree=${degree},
    include_bias=${includeBias ? 'True' : 'False'},
    interaction_only=${interactionOnly ? 'True' : 'False'}
)

transformed = poly.fit_transform(X)
feature_names = poly.get_feature_names_out(${JSON.stringify(featureColumns)}).tolist()

result = {
    'transformed': transformed.tolist(),
    'feature_names': feature_names,
    'n_input_features': poly.n_input_features_,
    'n_output_features': poly.n_output_features_,
    'degree': ${degree},
    'include_bias': ${includeBias ? 'True' : 'False'},
    'interaction_only': ${interactionOnly ? 'True' : 'False'},
    'input_columns': ${JSON.stringify(featureColumns)}
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

          result.feature_names.forEach((name: string, idx: number) => {
            newJson[name] = result.transformed[i][idx];
          });

          if (i === 0) {
            newJson.transformer = resultData;
            newJson.polynomial_features = result.feature_names;
            newJson.n_output_features = result.n_output_features;
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const transformerDataStr = this.getNodeParameter('transformerData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('transformFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const transformerInfo = JSON.parse(transformerDataStr);

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
from sklearn.preprocessing import PolynomialFeatures

X = np.array(json.loads(sys.argv[1]))
transformer_data = json.loads(sys.argv[2])

poly = PolynomialFeatures(
    degree=transformer_data['degree'],
    include_bias=transformer_data['include_bias'],
    interaction_only=transformer_data['interaction_only']
)

# Fit on dummy data with same number of features
poly.fit(np.zeros((1, len(transformer_data['input_columns']))))

transformed = poly.transform(X)
feature_names = poly.get_feature_names_out(transformer_data['input_columns']).tolist()

result = {
    'transformed': transformed.tolist(),
    'feature_names': feature_names
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), transformerDataStr]);
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
            newJson[name] = result.transformed[i][idx];
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

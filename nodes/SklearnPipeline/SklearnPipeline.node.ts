import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnPipeline implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Pipeline',
    name: 'sklearnPipeline',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Create and use sklearn pipelines chaining transformers and estimators',
    defaults: {
      name: 'Sklearn Pipeline',
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
            name: 'Train',
            value: 'train',
            description: 'Train a pipeline',
            action: 'Train pipeline',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions using trained pipeline',
            action: 'Predict',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform data (for transformer-only pipelines)',
            action: 'Transform',
          },
        ],
        default: 'train',
      },
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature column names',
        required: true,
      },
      {
        displayName: 'Target Column',
        name: 'targetColumn',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: '',
        placeholder: 'target',
        description: 'Name of the target column (leave empty for transformer-only pipelines)',
      },
      {
        displayName: 'Preprocessors',
        name: 'preprocessors',
        type: 'multiOptions',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Standard Scaler', value: 'StandardScaler' },
          { name: 'MinMax Scaler', value: 'MinMaxScaler' },
          { name: 'Robust Scaler', value: 'RobustScaler' },
          { name: 'Normalizer', value: 'Normalizer' },
          { name: 'PCA', value: 'PCA' },
          { name: 'Polynomial Features', value: 'PolynomialFeatures' },
        ],
        default: ['StandardScaler'],
        description: 'Preprocessing steps to include in the pipeline',
      },
      {
        displayName: 'Estimator',
        name: 'estimator',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'None (Transform Only)', value: 'none' },
          { name: 'Logistic Regression', value: 'LogisticRegression' },
          { name: 'Random Forest Classifier', value: 'RandomForestClassifier' },
          { name: 'Random Forest Regressor', value: 'RandomForestRegressor' },
          { name: 'Linear Regression', value: 'LinearRegression' },
          { name: 'SVC', value: 'SVC' },
          { name: 'SVR', value: 'SVR' },
          { name: 'Gradient Boosting Classifier', value: 'GradientBoostingClassifier' },
          { name: 'Gradient Boosting Regressor', value: 'GradientBoostingRegressor' },
        ],
        default: 'LogisticRegression',
        description: 'Final estimator in the pipeline',
      },
      {
        displayName: 'PCA Components',
        name: 'pcaComponents',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 2,
        description: 'Number of PCA components (if PCA is selected)',
      },
      {
        displayName: 'Polynomial Degree',
        name: 'polyDegree',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 2,
        description: 'Polynomial degree (if Polynomial Features is selected)',
      },
      {
        displayName: 'Pipeline Data',
        name: 'pipelineData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict', 'transform'],
          },
        },
        default: '',
        description: 'JSON string containing the trained pipeline',
        required: true,
      },
      {
        displayName: 'Feature Columns',
        name: 'predictFeatureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict', 'transform'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
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
      if (operation === 'train') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
        const preprocessors = this.getNodeParameter('preprocessors', 0) as string[];
        const estimator = this.getNodeParameter('estimator', 0) as string;
        const pcaComponents = this.getNodeParameter('pcaComponents', 0) as number;
        const polyDegree = this.getNodeParameter('polyDegree', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const isRegressor = ['LinearRegression', 'RandomForestRegressor', 'SVR', 'GradientBoostingRegressor'].includes(estimator);
        const hasTarget = targetColumn && targetColumn.trim() !== '' && estimator !== 'none';

        const trainingData = items.map((item, idx) => {
          const features = featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });

          let target = null;
          if (hasTarget) {
            target = item.json[targetColumn];
            if (target === undefined || target === null) {
              throw new NodeOperationError(this.getNode(), `Target column '${targetColumn}' not found`, { itemIndex: idx });
            }
            target = isRegressor ? parseFloat(String(target)) : target;
          }

          return { features, target };
        });

        const preprocessorImports: Record<string, string> = {
          StandardScaler: 'from sklearn.preprocessing import StandardScaler',
          MinMaxScaler: 'from sklearn.preprocessing import MinMaxScaler',
          RobustScaler: 'from sklearn.preprocessing import RobustScaler',
          Normalizer: 'from sklearn.preprocessing import Normalizer',
          PCA: 'from sklearn.decomposition import PCA',
          PolynomialFeatures: 'from sklearn.preprocessing import PolynomialFeatures',
        };

        const estimatorImports: Record<string, string> = {
          LogisticRegression: 'from sklearn.linear_model import LogisticRegression',
          RandomForestClassifier: 'from sklearn.ensemble import RandomForestClassifier',
          RandomForestRegressor: 'from sklearn.ensemble import RandomForestRegressor',
          LinearRegression: 'from sklearn.linear_model import LinearRegression',
          SVC: 'from sklearn.svm import SVC',
          SVR: 'from sklearn.svm import SVR',
          GradientBoostingClassifier: 'from sklearn.ensemble import GradientBoostingClassifier',
          GradientBoostingRegressor: 'from sklearn.ensemble import GradientBoostingRegressor',
        };

        const preprocessorParams: Record<string, string> = {
          StandardScaler: 'StandardScaler()',
          MinMaxScaler: 'MinMaxScaler()',
          RobustScaler: 'RobustScaler()',
          Normalizer: 'Normalizer()',
          PCA: `PCA(n_components=${pcaComponents})`,
          PolynomialFeatures: `PolynomialFeatures(degree=${polyDegree})`,
        };

        const imports = [
          'from sklearn.pipeline import Pipeline',
          ...preprocessors.map((p) => preprocessorImports[p]),
          ...(estimator !== 'none' ? [estimatorImports[estimator]] : []),
        ].join('\n');

        const steps = preprocessors.map((p, i) => `('${p.toLowerCase()}_${i}', ${preprocessorParams[p]})`);
        if (estimator !== 'none') {
          steps.push(`('estimator', ${estimator}())`);
        }

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
${imports}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
${hasTarget ? "y = np.array([d['target'] for d in data])" : ''}

pipeline = Pipeline([
    ${steps.join(',\n    ')}
])

${hasTarget ? 'pipeline.fit(X, y)' : 'pipeline.fit(X)'}

pipeline_bytes = pickle.dumps(pipeline)
pipeline_b64 = base64.b64encode(pipeline_bytes).decode('utf-8')

result = {
    'pipeline_pickle': pipeline_b64,
    'steps': ${JSON.stringify([...preprocessors, ...(estimator !== 'none' ? [estimator] : [])])},
    'has_estimator': ${estimator !== 'none' ? 'True' : 'False'},
    'feature_columns': ${JSON.stringify(featureColumns)}
}

${hasTarget ? "result['score'] = float(pipeline.score(X, y))" : ''}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(trainingData)]);
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

        const outputJson: any = {
          pipeline: resultData,
          steps: result.steps,
          has_estimator: result.has_estimator,
          feature_columns: result.feature_columns,
          training_samples: items.length,
        };

        if (result.score !== undefined) {
          outputJson.score = result.score;
        }

        returnData.push({ json: outputJson });

      } else if (operation === 'predict' || operation === 'transform') {
        const pipelineDataStr = this.getNodeParameter('pipelineData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());
        const pipelineInfo = JSON.parse(pipelineDataStr);

        const features = items.map((item, idx) => {
          return featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const method = operation === 'predict' && pipelineInfo.has_estimator ? 'predict' : 'transform';

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64

pipeline_data = json.loads(sys.argv[1])
X = np.array(json.loads(sys.argv[2]))

pipeline_bytes = base64.b64decode(pipeline_data['pipeline_pickle'])
pipeline = pickle.loads(pipeline_bytes)

output = pipeline.${method}(X)

result = {'output': output.tolist()}

# Try to get probabilities for classifiers
if '${method}' == 'predict':
    try:
        result['probabilities'] = pipeline.predict_proba(X).tolist()
    except:
        pass

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, pipelineDataStr, JSON.stringify(features)]);
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

          if (operation === 'predict' && pipelineInfo.has_estimator) {
            newJson.prediction = result.output[i];
            if (result.probabilities) {
              newJson.probabilities = result.probabilities[i];
            }
          } else {
            // Transform output
            if (Array.isArray(result.output[i])) {
              result.output[i].forEach((val: number, idx: number) => {
                newJson[`transformed_${idx + 1}`] = val;
              });
            } else {
              newJson.transformed = result.output[i];
            }
          }

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

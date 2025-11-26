import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnCalibratedClassifierCV implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Calibrated Classifier',
    name: 'sklearnCalibratedClassifierCV',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} - {{$parameter["method"]}}',
    description: 'Probability calibration for classifiers using scikit-learn',
    defaults: {
      name: 'Sklearn Calibrated Classifier',
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
            description: 'Train calibrated classifier',
            action: 'Train model',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions with calibrated probabilities',
            action: 'Predict',
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
        description: 'Name of the target column',
        required: true,
      },
      {
        displayName: 'Base Estimator',
        name: 'baseEstimator',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'SVC', value: 'SVC' },
          { name: 'Random Forest', value: 'RandomForestClassifier' },
          { name: 'Gradient Boosting', value: 'GradientBoostingClassifier' },
          { name: 'Logistic Regression', value: 'LogisticRegression' },
          { name: 'Gaussian NB', value: 'GaussianNB' },
        ],
        default: 'SVC',
        description: 'Base classifier to calibrate',
      },
      {
        displayName: 'Calibration Method',
        name: 'method',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Sigmoid (Platt)', value: 'sigmoid', description: 'Platt scaling' },
          { name: 'Isotonic', value: 'isotonic', description: 'Non-parametric isotonic regression' },
        ],
        default: 'sigmoid',
        description: 'Calibration method',
      },
      {
        displayName: 'CV Folds',
        name: 'cv',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        default: 5,
        description: 'Number of cross-validation folds',
      },
      {
        displayName: 'Model Data',
        name: 'modelData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict'],
          },
        },
        default: '',
        description: 'JSON string containing the trained model',
        required: true,
      },
      {
        displayName: 'Feature Columns',
        name: 'predictFeatureColumns',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['predict'],
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
        const baseEstimator = this.getNodeParameter('baseEstimator', 0) as string;
        const method = this.getNodeParameter('method', 0) as string;
        const cv = this.getNodeParameter('cv', 0) as number;

        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const trainingData = items.map((item, idx) => {
          const features = featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });

          const target = item.json[targetColumn];
          if (target === undefined || target === null) {
            throw new NodeOperationError(this.getNode(), `Target column '${targetColumn}' not found`, { itemIndex: idx });
          }

          return { features, target };
        });

        const estimatorImports: Record<string, string> = {
          LogisticRegression: 'from sklearn.linear_model import LogisticRegression',
          RandomForestClassifier: 'from sklearn.ensemble import RandomForestClassifier',
          SVC: 'from sklearn.svm import SVC',
          GradientBoostingClassifier: 'from sklearn.ensemble import GradientBoostingClassifier',
          GaussianNB: 'from sklearn.naive_bayes import GaussianNB',
        };

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.calibration import CalibratedClassifierCV
${estimatorImports[baseEstimator]}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

base_clf = ${baseEstimator}()
model = CalibratedClassifierCV(
    estimator=base_clf,
    method='${method}',
    cv=${cv}
)

model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'base_estimator': '${baseEstimator}',
    'method': '${method}',
    'classes': model.classes_.tolist(),
    'feature_columns': ${JSON.stringify(featureColumns)}
}

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

        returnData.push({
          json: {
            model: resultData,
            base_estimator: result.base_estimator,
            calibration_method: result.method,
            classes: result.classes,
            feature_columns: result.feature_columns,
            training_samples: items.length,
          },
        });

      } else if (operation === 'predict') {
        const modelDataStr = this.getNodeParameter('modelData', 0) as string;
        const featureColumnsStr = this.getNodeParameter('predictFeatureColumns', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const features = items.map((item, idx) => {
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
import pickle
import base64

model_data = json.loads(sys.argv[1])
X = np.array(json.loads(sys.argv[2]))

model_bytes = base64.b64decode(model_data['model_pickle'])
model = pickle.loads(model_bytes)

predictions = model.predict(X).tolist()
probabilities = model.predict_proba(X).tolist()

result = {
    'predictions': predictions,
    'calibrated_probabilities': probabilities
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, modelDataStr, JSON.stringify(features)]);
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
          returnData.push({
            json: {
              ...items[i].json,
              prediction: result.predictions[i],
              calibrated_probabilities: result.calibrated_probabilities[i],
            },
          });
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnVotingClassifier implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Voting Classifier',
    name: 'sklearnVotingClassifier',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}} - {{$parameter["voting"]}} voting',
    description: 'Ensemble voting classifier combining multiple models',
    defaults: {
      name: 'Sklearn Voting Classifier',
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
            description: 'Train voting classifier',
            action: 'Train model',
          },
          {
            name: 'Predict',
            value: 'predict',
            description: 'Make predictions',
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
        displayName: 'Estimators',
        name: 'estimators',
        type: 'multiOptions',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Logistic Regression', value: 'LogisticRegression' },
          { name: 'Random Forest', value: 'RandomForestClassifier' },
          { name: 'Decision Tree', value: 'DecisionTreeClassifier' },
          { name: 'SVC', value: 'SVC' },
          { name: 'KNN', value: 'KNeighborsClassifier' },
          { name: 'Gradient Boosting', value: 'GradientBoostingClassifier' },
          { name: 'Gaussian NB', value: 'GaussianNB' },
        ],
        default: ['LogisticRegression', 'RandomForestClassifier', 'GaussianNB'],
        description: 'Select estimators to include in the ensemble',
      },
      {
        displayName: 'Voting',
        name: 'voting',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['train'],
          },
        },
        options: [
          { name: 'Hard', value: 'hard', description: 'Majority voting' },
          { name: 'Soft', value: 'soft', description: 'Average predicted probabilities' },
        ],
        default: 'soft',
        description: 'Voting strategy',
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
        const estimators = this.getNodeParameter('estimators', 0) as string[];
        const voting = this.getNodeParameter('voting', 0) as string;

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
          DecisionTreeClassifier: 'from sklearn.tree import DecisionTreeClassifier',
          SVC: 'from sklearn.svm import SVC',
          KNeighborsClassifier: 'from sklearn.neighbors import KNeighborsClassifier',
          GradientBoostingClassifier: 'from sklearn.ensemble import GradientBoostingClassifier',
          GaussianNB: 'from sklearn.naive_bayes import GaussianNB',
        };

        const imports = estimators.map((e) => estimatorImports[e]).join('\n');
        const estimatorList = estimators.map((e, i) => `('${e.toLowerCase()}_${i}', ${e}(${e === 'SVC' && voting === 'soft' ? 'probability=True' : ''}))`).join(', ');

        const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.ensemble import VotingClassifier
${imports}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

estimators = [${estimatorList}]

model = VotingClassifier(
    estimators=estimators,
    voting='${voting}'
)

model.fit(X, y)

model_bytes = pickle.dumps(model)
model_b64 = base64.b64encode(model_bytes).decode('utf-8')

result = {
    'model_pickle': model_b64,
    'score': float(model.score(X, y)),
    'voting': '${voting}',
    'estimators': ${JSON.stringify(estimators)},
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
            score: result.score,
            voting: result.voting,
            estimators: result.estimators,
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

result = {'predictions': predictions}

if model_data['voting'] == 'soft':
    result['probabilities'] = model.predict_proba(X).tolist()

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
          const outputJson: any = {
            ...items[i].json,
            prediction: result.predictions[i],
          };
          if (result.probabilities) {
            outputJson.probabilities = result.probabilities[i];
          }
          returnData.push({ json: outputJson });
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

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnFeatureSelection implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Feature Selection',
    name: 'sklearnFeatureSelection',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["method"]}}',
    description: 'Select best features using various sklearn methods',
    defaults: {
      name: 'Sklearn Feature Selection',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Method',
        name: 'method',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Select K Best',
            value: 'selectKBest',
            description: 'Select K highest scoring features',
          },
          {
            name: 'Select Percentile',
            value: 'selectPercentile',
            description: 'Select top percentile of features',
          },
          {
            name: 'Variance Threshold',
            value: 'varianceThreshold',
            description: 'Remove low-variance features',
          },
          {
            name: 'RFE (Recursive Feature Elimination)',
            value: 'rfe',
            description: 'Recursively eliminate features',
          },
        ],
        default: 'selectKBest',
      },
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
        displayName: 'Target Column',
        name: 'targetColumn',
        type: 'string',
        displayOptions: {
          hide: {
            method: ['varianceThreshold'],
          },
        },
        default: '',
        placeholder: 'target',
        description: 'Name of the target column',
        required: true,
      },
      {
        displayName: 'K (Number of Features)',
        name: 'k',
        type: 'number',
        displayOptions: {
          show: {
            method: ['selectKBest', 'rfe'],
          },
        },
        default: 5,
        description: 'Number of top features to select',
      },
      {
        displayName: 'Percentile',
        name: 'percentile',
        type: 'number',
        displayOptions: {
          show: {
            method: ['selectPercentile'],
          },
        },
        default: 50,
        description: 'Percent of features to keep (0-100)',
      },
      {
        displayName: 'Variance Threshold',
        name: 'threshold',
        type: 'number',
        displayOptions: {
          show: {
            method: ['varianceThreshold'],
          },
        },
        default: 0.0,
        description: 'Features with variance below this are removed',
      },
      {
        displayName: 'Score Function',
        name: 'scoreFunc',
        type: 'options',
        displayOptions: {
          show: {
            method: ['selectKBest', 'selectPercentile'],
          },
        },
        options: [
          { name: 'F-Classif (Classification)', value: 'f_classif' },
          { name: 'Mutual Info (Classification)', value: 'mutual_info_classif' },
          { name: 'F-Regression (Regression)', value: 'f_regression' },
          { name: 'Mutual Info (Regression)', value: 'mutual_info_regression' },
          { name: 'Chi2 (Non-negative)', value: 'chi2' },
        ],
        default: 'f_classif',
        description: 'Function to score features',
      },
      {
        displayName: 'Estimator (for RFE)',
        name: 'estimator',
        type: 'options',
        displayOptions: {
          show: {
            method: ['rfe'],
          },
        },
        options: [
          { name: 'Logistic Regression', value: 'LogisticRegression' },
          { name: 'Random Forest Classifier', value: 'RandomForestClassifier' },
          { name: 'Linear Regression', value: 'LinearRegression' },
          { name: 'Random Forest Regressor', value: 'RandomForestRegressor' },
        ],
        default: 'LogisticRegression',
        description: 'Base estimator for RFE',
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

    const method = this.getNodeParameter('method', 0) as string;
    const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

    try {
      const features = items.map((item, idx) => {
        return featureColumns.map((col) => {
          const value = item.json[col];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Feature column '${col}' not found`, { itemIndex: idx });
          }
          return parseFloat(String(value));
        });
      });

      let targets: any[] = [];
      if (method !== 'varianceThreshold') {
        const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
        targets = items.map((item, idx) => {
          const value = item.json[targetColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Target column '${targetColumn}' not found`, { itemIndex: idx });
          }
          return value;
        });
      }

      let pythonScript = '';

      if (method === 'selectKBest') {
        const k = this.getNodeParameter('k', 0) as number;
        const scoreFunc = this.getNodeParameter('scoreFunc', 0) as string;

        pythonScript = `
import json
import sys
import numpy as np
from sklearn.feature_selection import SelectKBest, ${scoreFunc}

X = np.array(json.loads(sys.argv[1]))
y = np.array(json.loads(sys.argv[2]))
feature_names = ${JSON.stringify(featureColumns)}

selector = SelectKBest(score_func=${scoreFunc}, k=${k})
X_selected = selector.fit_transform(X, y)

mask = selector.get_support()
scores = selector.scores_.tolist()
selected_features = [f for f, m in zip(feature_names, mask) if m]

result = {
    'transformed': X_selected.tolist(),
    'selected_features': selected_features,
    'feature_scores': dict(zip(feature_names, scores)),
    'support_mask': mask.tolist()
}

print(json.dumps(result))
`;
      } else if (method === 'selectPercentile') {
        const percentile = this.getNodeParameter('percentile', 0) as number;
        const scoreFunc = this.getNodeParameter('scoreFunc', 0) as string;

        pythonScript = `
import json
import sys
import numpy as np
from sklearn.feature_selection import SelectPercentile, ${scoreFunc}

X = np.array(json.loads(sys.argv[1]))
y = np.array(json.loads(sys.argv[2]))
feature_names = ${JSON.stringify(featureColumns)}

selector = SelectPercentile(score_func=${scoreFunc}, percentile=${percentile})
X_selected = selector.fit_transform(X, y)

mask = selector.get_support()
scores = selector.scores_.tolist()
selected_features = [f for f, m in zip(feature_names, mask) if m]

result = {
    'transformed': X_selected.tolist(),
    'selected_features': selected_features,
    'feature_scores': dict(zip(feature_names, scores)),
    'support_mask': mask.tolist()
}

print(json.dumps(result))
`;
      } else if (method === 'varianceThreshold') {
        const threshold = this.getNodeParameter('threshold', 0) as number;

        pythonScript = `
import json
import sys
import numpy as np
from sklearn.feature_selection import VarianceThreshold

X = np.array(json.loads(sys.argv[1]))
feature_names = ${JSON.stringify(featureColumns)}

selector = VarianceThreshold(threshold=${threshold})
X_selected = selector.fit_transform(X)

mask = selector.get_support()
variances = selector.variances_.tolist()
selected_features = [f for f, m in zip(feature_names, mask) if m]

result = {
    'transformed': X_selected.tolist(),
    'selected_features': selected_features,
    'feature_variances': dict(zip(feature_names, variances)),
    'support_mask': mask.tolist()
}

print(json.dumps(result))
`;
      } else if (method === 'rfe') {
        const k = this.getNodeParameter('k', 0) as number;
        const estimator = this.getNodeParameter('estimator', 0) as string;

        const estimatorImports: Record<string, string> = {
          LogisticRegression: 'from sklearn.linear_model import LogisticRegression',
          RandomForestClassifier: 'from sklearn.ensemble import RandomForestClassifier',
          LinearRegression: 'from sklearn.linear_model import LinearRegression',
          RandomForestRegressor: 'from sklearn.ensemble import RandomForestRegressor',
        };

        pythonScript = `
import json
import sys
import numpy as np
from sklearn.feature_selection import RFE
${estimatorImports[estimator]}

X = np.array(json.loads(sys.argv[1]))
y = np.array(json.loads(sys.argv[2]))
feature_names = ${JSON.stringify(featureColumns)}

estimator = ${estimator}()
selector = RFE(estimator, n_features_to_select=${k})
X_selected = selector.fit_transform(X, y)

mask = selector.get_support()
rankings = selector.ranking_.tolist()
selected_features = [f for f, m in zip(feature_names, mask) if m]

result = {
    'transformed': X_selected.tolist(),
    'selected_features': selected_features,
    'feature_rankings': dict(zip(feature_names, rankings)),
    'support_mask': mask.tolist()
}

print(json.dumps(result))
`;
      }

      const { spawn } = require('child_process');
      const args = method === 'varianceThreshold'
        ? ['-c', pythonScript, JSON.stringify(features)]
        : ['-c', pythonScript, JSON.stringify(features), JSON.stringify(targets)];

      const resultData = await new Promise<string>((resolve, reject) => {
        const python = spawn(pythonPath, args);
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

        // Add selected feature values
        result.selected_features.forEach((feat: string, idx: number) => {
          newJson[`selected_${feat}`] = result.transformed[i][idx];
        });

        if (i === 0) {
          newJson.selected_features = result.selected_features;
          newJson.n_features_selected = result.selected_features.length;
          if (result.feature_scores) newJson.feature_scores = result.feature_scores;
          if (result.feature_variances) newJson.feature_variances = result.feature_variances;
          if (result.feature_rankings) newJson.feature_rankings = result.feature_rankings;
        }

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

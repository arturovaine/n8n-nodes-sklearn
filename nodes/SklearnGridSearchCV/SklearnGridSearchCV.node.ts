import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnGridSearchCV implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Grid Search CV',
    name: 'sklearnGridSearchCV',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["modelType"]}} - Grid Search',
    description: 'Perform hyperparameter tuning using Grid Search with Cross-Validation',
    defaults: {
      name: 'Sklearn Grid Search CV',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Model Type',
        name: 'modelType',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Logistic Regression', value: 'LogisticRegression' },
          { name: 'Decision Tree Classifier', value: 'DecisionTreeClassifier' },
          { name: 'Decision Tree Regressor', value: 'DecisionTreeRegressor' },
          { name: 'Random Forest Classifier', value: 'RandomForestClassifier' },
          { name: 'Random Forest Regressor', value: 'RandomForestRegressor' },
          { name: 'SVC', value: 'SVC' },
          { name: 'SVR', value: 'SVR' },
          { name: 'KNN Classifier', value: 'KNeighborsClassifier' },
          { name: 'KNN Regressor', value: 'KNeighborsRegressor' },
          { name: 'Gradient Boosting Classifier', value: 'GradientBoostingClassifier' },
          { name: 'Gradient Boosting Regressor', value: 'GradientBoostingRegressor' },
        ],
        default: 'LogisticRegression',
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
        default: '',
        placeholder: 'target',
        description: 'Name of the target column',
        required: true,
      },
      {
        displayName: 'Parameter Grid (JSON)',
        name: 'paramGrid',
        type: 'string',
        default: '{}',
        placeholder: '{"C": [0.1, 1, 10], "kernel": ["linear", "rbf"]}',
        description: 'JSON object defining the hyperparameter grid to search',
        required: true,
      },
      {
        displayName: 'Number of Folds',
        name: 'cv',
        type: 'number',
        default: 5,
        description: 'Number of cross-validation folds',
      },
      {
        displayName: 'Scoring Metric',
        name: 'scoring',
        type: 'options',
        options: [
          { name: 'Accuracy (Classification)', value: 'accuracy' },
          { name: 'F1 Score', value: 'f1_weighted' },
          { name: 'Precision', value: 'precision_weighted' },
          { name: 'Recall', value: 'recall_weighted' },
          { name: 'ROC AUC', value: 'roc_auc' },
          { name: 'R² Score (Regression)', value: 'r2' },
          { name: 'Negative MSE', value: 'neg_mean_squared_error' },
          { name: 'Negative MAE', value: 'neg_mean_absolute_error' },
        ],
        default: 'accuracy',
        description: 'Scoring metric for evaluating models',
      },
      {
        displayName: 'Return Best Model',
        name: 'returnModel',
        type: 'boolean',
        default: true,
        description: 'Whether to return the best trained model for predictions',
      },
      {
        displayName: 'Number of Jobs',
        name: 'nJobs',
        type: 'number',
        default: -1,
        description: 'Number of parallel jobs (-1 uses all processors)',
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

    const modelType = this.getNodeParameter('modelType', 0) as string;
    const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
    const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
    const paramGridStr = this.getNodeParameter('paramGrid', 0) as string;
    const cv = this.getNodeParameter('cv', 0) as number;
    const scoring = this.getNodeParameter('scoring', 0) as string;
    const returnModel = this.getNodeParameter('returnModel', 0) as boolean;
    const nJobs = this.getNodeParameter('nJobs', 0) as number;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

    try {
      const isRegressor = ['DecisionTreeRegressor', 'RandomForestRegressor', 'SVR', 'KNeighborsRegressor', 'GradientBoostingRegressor'].includes(modelType);

      const data = items.map((item, idx) => {
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

        return { features, target: isRegressor ? parseFloat(String(target)) : target };
      });

      // Validate param grid JSON
      let paramGrid;
      try {
        paramGrid = JSON.parse(paramGridStr);
      } catch {
        throw new NodeOperationError(this.getNode(), 'Invalid JSON in Parameter Grid');
      }

      const modelImports: Record<string, string> = {
        LogisticRegression: 'from sklearn.linear_model import LogisticRegression',
        DecisionTreeClassifier: 'from sklearn.tree import DecisionTreeClassifier',
        DecisionTreeRegressor: 'from sklearn.tree import DecisionTreeRegressor',
        RandomForestClassifier: 'from sklearn.ensemble import RandomForestClassifier',
        RandomForestRegressor: 'from sklearn.ensemble import RandomForestRegressor',
        GradientBoostingClassifier: 'from sklearn.ensemble import GradientBoostingClassifier',
        GradientBoostingRegressor: 'from sklearn.ensemble import GradientBoostingRegressor',
        SVC: 'from sklearn.svm import SVC',
        SVR: 'from sklearn.svm import SVR',
        KNeighborsClassifier: 'from sklearn.neighbors import KNeighborsClassifier',
        KNeighborsRegressor: 'from sklearn.neighbors import KNeighborsRegressor',
      };

      const pythonScript = `
import json
import sys
import numpy as np
import pickle
import base64
from sklearn.model_selection import GridSearchCV
${modelImports[modelType]}

data = json.loads(sys.argv[1])
param_grid = json.loads(sys.argv[2])

X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelType}()
grid_search = GridSearchCV(
    model,
    param_grid,
    cv=${cv},
    scoring='${scoring}',
    n_jobs=${nJobs},
    return_train_score=True
)

grid_search.fit(X, y)

result = {
    'best_params': grid_search.best_params_,
    'best_score': float(grid_search.best_score_),
    'cv_results': {
        'mean_test_score': grid_search.cv_results_['mean_test_score'].tolist(),
        'std_test_score': grid_search.cv_results_['std_test_score'].tolist(),
        'mean_train_score': grid_search.cv_results_['mean_train_score'].tolist(),
        'params': [str(p) for p in grid_search.cv_results_['params']],
        'rank_test_score': grid_search.cv_results_['rank_test_score'].tolist()
    },
    'n_splits': grid_search.n_splits_,
    'scoring': '${scoring}',
    'model_type': '${modelType}'
}

if ${returnModel ? 'True' : 'False'}:
    model_bytes = pickle.dumps(grid_search.best_estimator_)
    result['best_model_pickle'] = base64.b64encode(model_bytes).decode('utf-8')
    result['feature_columns'] = ${JSON.stringify(featureColumns)}

print(json.dumps(result))
`;

      const { spawn } = require('child_process');
      const resultData = await new Promise<string>((resolve, reject) => {
        const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(data), JSON.stringify(paramGrid)]);
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
        model_type: result.model_type,
        best_params: result.best_params,
        best_score: result.best_score,
        scoring_metric: result.scoring,
        n_splits: result.n_splits,
        total_samples: items.length,
        all_results: result.cv_results.params.map((params: string, i: number) => ({
          params,
          mean_test_score: result.cv_results.mean_test_score[i],
          std_test_score: result.cv_results.std_test_score[i],
          mean_train_score: result.cv_results.mean_train_score[i],
          rank: result.cv_results.rank_test_score[i],
        })),
      };

      if (returnModel && result.best_model_pickle) {
        outputJson.best_model = JSON.stringify({
          model_pickle: result.best_model_pickle,
          model_type: result.model_type,
          feature_columns: result.feature_columns,
        });
      }

      returnData.push({ json: outputJson });

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

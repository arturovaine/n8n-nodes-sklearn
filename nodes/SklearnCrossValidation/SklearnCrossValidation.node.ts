import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnCrossValidation implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Cross Validation',
    name: 'sklearnCrossValidation',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["cvMethod"]}} - {{$parameter["folds"]}} folds',
    description: 'Perform cross-validation on sklearn models',
    defaults: {
      name: 'Sklearn Cross Validation',
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
          { name: 'Linear Regression', value: 'LinearRegression' },
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
          { name: 'Gaussian NB', value: 'GaussianNB' },
        ],
        default: 'LogisticRegression',
      },
      {
        displayName: 'CV Method',
        name: 'cvMethod',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'K-Fold', value: 'kfold', description: 'Standard K-Fold cross-validation' },
          { name: 'Stratified K-Fold', value: 'stratified', description: 'Preserves class distribution (classification only)' },
          { name: 'Leave One Out', value: 'loo', description: 'Each sample is used once as test set' },
          { name: 'Shuffle Split', value: 'shuffle', description: 'Random permutation cross-validation' },
        ],
        default: 'kfold',
      },
      {
        displayName: 'Number of Folds',
        name: 'folds',
        type: 'number',
        displayOptions: {
          show: {
            cvMethod: ['kfold', 'stratified', 'shuffle'],
          },
        },
        default: 5,
        description: 'Number of folds for cross-validation',
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
        description: 'Scoring metric for cross-validation',
      },
      {
        displayName: 'Random State',
        name: 'randomState',
        type: 'number',
        default: 42,
        description: 'Random seed for reproducibility',
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
    const cvMethod = this.getNodeParameter('cvMethod', 0) as string;
    const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
    const targetColumn = this.getNodeParameter('targetColumn', 0) as string;
    const scoring = this.getNodeParameter('scoring', 0) as string;
    const randomState = this.getNodeParameter('randomState', 0) as number;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    let folds = 5;
    if (cvMethod !== 'loo') {
      folds = this.getNodeParameter('folds', 0) as number;
    }

    const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

    try {
      const isRegressor = ['LinearRegression', 'DecisionTreeRegressor', 'RandomForestRegressor', 'SVR', 'KNeighborsRegressor', 'GradientBoostingRegressor'].includes(modelType);

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

      const modelImports: Record<string, string> = {
        LinearRegression: 'from sklearn.linear_model import LinearRegression',
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
        GaussianNB: 'from sklearn.naive_bayes import GaussianNB',
      };

      const cvImports: Record<string, string> = {
        kfold: 'from sklearn.model_selection import KFold',
        stratified: 'from sklearn.model_selection import StratifiedKFold',
        loo: 'from sklearn.model_selection import LeaveOneOut',
        shuffle: 'from sklearn.model_selection import ShuffleSplit',
      };

      const cvInit: Record<string, string> = {
        kfold: `KFold(n_splits=${folds}, shuffle=True, random_state=${randomState})`,
        stratified: `StratifiedKFold(n_splits=${folds}, shuffle=True, random_state=${randomState})`,
        loo: 'LeaveOneOut()',
        shuffle: `ShuffleSplit(n_splits=${folds}, test_size=0.2, random_state=${randomState})`,
      };

      const pythonScript = `
import json
import sys
import numpy as np
from sklearn.model_selection import cross_val_score, cross_validate
${modelImports[modelType]}
${cvImports[cvMethod]}

data = json.loads(sys.argv[1])
X = np.array([d['features'] for d in data])
y = np.array([d['target'] for d in data])

model = ${modelType}()
cv = ${cvInit[cvMethod]}

# Perform cross-validation
cv_results = cross_validate(model, X, y, cv=cv, scoring='${scoring}', return_train_score=True)

result = {
    'test_scores': cv_results['test_score'].tolist(),
    'train_scores': cv_results['train_score'].tolist(),
    'fit_times': cv_results['fit_time'].tolist(),
    'score_times': cv_results['score_time'].tolist(),
    'mean_test_score': float(cv_results['test_score'].mean()),
    'std_test_score': float(cv_results['test_score'].std()),
    'mean_train_score': float(cv_results['train_score'].mean()),
    'std_train_score': float(cv_results['train_score'].std()),
    'n_folds': len(cv_results['test_score']),
    'scoring': '${scoring}',
    'model_type': '${modelType}',
    'cv_method': '${cvMethod}'
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

      returnData.push({
        json: {
          model_type: result.model_type,
          cv_method: result.cv_method,
          scoring_metric: result.scoring,
          n_folds: result.n_folds,
          mean_test_score: result.mean_test_score,
          std_test_score: result.std_test_score,
          mean_train_score: result.mean_train_score,
          std_train_score: result.std_train_score,
          test_scores_per_fold: result.test_scores,
          train_scores_per_fold: result.train_scores,
          fit_times: result.fit_times,
          total_samples: items.length,
        },
      });

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

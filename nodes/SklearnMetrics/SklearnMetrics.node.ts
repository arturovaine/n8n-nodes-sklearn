import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnMetrics implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn Metrics',
    name: 'sklearnMetrics',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["metricType"]}}',
    description: 'Calculate model evaluation metrics using scikit-learn',
    defaults: {
      name: 'Sklearn Metrics',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Metric Type',
        name: 'metricType',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Classification Metrics',
            value: 'classification',
            description: 'Accuracy, precision, recall, F1, confusion matrix',
          },
          {
            name: 'Regression Metrics',
            value: 'regression',
            description: 'MSE, RMSE, MAE, R², MAPE',
          },
          {
            name: 'Clustering Metrics',
            value: 'clustering',
            description: 'Silhouette score, Calinski-Harabasz, Davies-Bouldin',
          },
        ],
        default: 'classification',
      },
      {
        displayName: 'True Values Column',
        name: 'trueColumn',
        type: 'string',
        displayOptions: {
          show: {
            metricType: ['classification', 'regression'],
          },
        },
        default: '',
        placeholder: 'actual',
        description: 'Column containing actual/true values',
        required: true,
      },
      {
        displayName: 'Predicted Values Column',
        name: 'predictedColumn',
        type: 'string',
        displayOptions: {
          show: {
            metricType: ['classification', 'regression'],
          },
        },
        default: '',
        placeholder: 'prediction',
        description: 'Column containing predicted values',
        required: true,
      },
      {
        displayName: 'Feature Columns',
        name: 'featureColumns',
        type: 'string',
        displayOptions: {
          show: {
            metricType: ['clustering'],
          },
        },
        default: '',
        placeholder: 'feature1,feature2,feature3',
        description: 'Comma-separated list of feature columns used for clustering',
        required: true,
      },
      {
        displayName: 'Cluster Labels Column',
        name: 'clusterColumn',
        type: 'string',
        displayOptions: {
          show: {
            metricType: ['clustering'],
          },
        },
        default: '',
        placeholder: 'cluster',
        description: 'Column containing cluster labels',
        required: true,
      },
      {
        displayName: 'Average Method',
        name: 'average',
        type: 'options',
        displayOptions: {
          show: {
            metricType: ['classification'],
          },
        },
        options: [
          { name: 'Binary', value: 'binary', description: 'For binary classification' },
          { name: 'Micro', value: 'micro', description: 'Global averaging' },
          { name: 'Macro', value: 'macro', description: 'Unweighted mean per class' },
          { name: 'Weighted', value: 'weighted', description: 'Weighted mean per class' },
        ],
        default: 'weighted',
        description: 'Averaging method for multi-class metrics',
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
    const metricType = this.getNodeParameter('metricType', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;

    try {
      if (metricType === 'classification') {
        const trueColumn = this.getNodeParameter('trueColumn', 0) as string;
        const predictedColumn = this.getNodeParameter('predictedColumn', 0) as string;
        const average = this.getNodeParameter('average', 0) as string;

        const yTrue = items.map((item, idx) => {
          const value = item.json[trueColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${trueColumn}' not found`, { itemIndex: idx });
          }
          return value;
        });

        const yPred = items.map((item, idx) => {
          const value = item.json[predictedColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${predictedColumn}' not found`, { itemIndex: idx });
          }
          return value;
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

y_true = json.loads(sys.argv[1])
y_pred = json.loads(sys.argv[2])
average = sys.argv[3]

# Handle binary case
avg_param = average if average != 'binary' else 'binary'
try:
    precision = precision_score(y_true, y_pred, average=avg_param, zero_division=0)
    recall = recall_score(y_true, y_pred, average=avg_param, zero_division=0)
    f1 = f1_score(y_true, y_pred, average=avg_param, zero_division=0)
except:
    # Fallback to weighted for multiclass
    precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)

result = {
    'accuracy': float(accuracy_score(y_true, y_pred)),
    'precision': float(precision),
    'recall': float(recall),
    'f1_score': float(f1),
    'confusion_matrix': confusion_matrix(y_true, y_pred).tolist(),
    'support': len(y_true),
    'unique_classes': list(set(y_true))
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const metricsData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(yTrue), JSON.stringify(yPred), average]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const metrics = JSON.parse(metricsData);
        returnData.push({ json: metrics });

      } else if (metricType === 'regression') {
        const trueColumn = this.getNodeParameter('trueColumn', 0) as string;
        const predictedColumn = this.getNodeParameter('predictedColumn', 0) as string;

        const yTrue = items.map((item, idx) => {
          const value = item.json[trueColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${trueColumn}' not found`, { itemIndex: idx });
          }
          return parseFloat(String(value));
        });

        const yPred = items.map((item, idx) => {
          const value = item.json[predictedColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${predictedColumn}' not found`, { itemIndex: idx });
          }
          return parseFloat(String(value));
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error, r2_score,
    mean_absolute_percentage_error, explained_variance_score
)

y_true = np.array(json.loads(sys.argv[1]))
y_pred = np.array(json.loads(sys.argv[2]))

mse = mean_squared_error(y_true, y_pred)

result = {
    'mse': float(mse),
    'rmse': float(np.sqrt(mse)),
    'mae': float(mean_absolute_error(y_true, y_pred)),
    'r2_score': float(r2_score(y_true, y_pred)),
    'mape': float(mean_absolute_percentage_error(y_true, y_pred)),
    'explained_variance': float(explained_variance_score(y_true, y_pred)),
    'support': len(y_true)
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const metricsData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(yTrue), JSON.stringify(yPred)]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const metrics = JSON.parse(metricsData);
        returnData.push({ json: metrics });

      } else if (metricType === 'clustering') {
        const featureColumnsStr = this.getNodeParameter('featureColumns', 0) as string;
        const clusterColumn = this.getNodeParameter('clusterColumn', 0) as string;
        const featureColumns = featureColumnsStr.split(',').map((col) => col.trim());

        const features = items.map((item, idx) => {
          return featureColumns.map((col) => {
            const value = item.json[col];
            if (value === undefined || value === null) {
              throw new NodeOperationError(this.getNode(), `Column '${col}' not found`, { itemIndex: idx });
            }
            return parseFloat(String(value));
          });
        });

        const labels = items.map((item, idx) => {
          const value = item.json[clusterColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Column '${clusterColumn}' not found`, { itemIndex: idx });
          }
          return parseInt(String(value));
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.metrics import (
    silhouette_score, calinski_harabasz_score, davies_bouldin_score
)

X = np.array(json.loads(sys.argv[1]))
labels = np.array(json.loads(sys.argv[2]))

n_clusters = len(set(labels))

result = {
    'n_clusters': n_clusters,
    'n_samples': len(labels)
}

if n_clusters > 1 and n_clusters < len(labels):
    result['silhouette_score'] = float(silhouette_score(X, labels))
    result['calinski_harabasz_score'] = float(calinski_harabasz_score(X, labels))
    result['davies_bouldin_score'] = float(davies_bouldin_score(X, labels))
else:
    result['error'] = 'Need at least 2 clusters and more samples than clusters'

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const metricsData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(features), JSON.stringify(labels)]);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => { output += data.toString(); });
          python.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

          python.on('close', (code: number) => {
            if (code !== 0) reject(new Error(`Python script failed: ${errorOutput}`));
            else resolve(output.trim());
          });
        });

        const metrics = JSON.parse(metricsData);
        returnData.push({ json: metrics });
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

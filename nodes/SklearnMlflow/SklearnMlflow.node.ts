import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnMlflow implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn MLflow',
    name: 'sklearnMlflow',
    icon: 'file:mlflow.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Track ML experiments and log models with MLflow',
    defaults: {
      name: 'Sklearn MLflow',
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
            name: 'Start Run',
            value: 'startRun',
            description: 'Start a new MLflow experiment run',
            action: 'Start a new MLflow experiment run',
          },
          {
            name: 'Log Metrics',
            value: 'logMetrics',
            description: 'Log metrics to current run',
            action: 'Log metrics to current run',
          },
          {
            name: 'Log Parameters',
            value: 'logParams',
            description: 'Log parameters to current run',
            action: 'Log parameters to current run',
          },
          {
            name: 'Log Model',
            value: 'logModel',
            description: 'Log a scikit-learn model',
            action: 'Log a scikit-learn model',
          },
          {
            name: 'End Run',
            value: 'endRun',
            description: 'End the current MLflow run',
            action: 'End the current MLflow run',
          },
        ],
        default: 'startRun',
      },
      // Start Run parameters
      {
        displayName: 'Experiment Name',
        name: 'experimentName',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['startRun'],
          },
        },
        default: 'sklearn-experiment',
        description: 'Name of the MLflow experiment',
      },
      {
        displayName: 'Run Name',
        name: 'runName',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['startRun'],
          },
        },
        default: '',
        placeholder: 'Optional run name',
        description: 'Name for this specific run (optional)',
      },
      // Log Metrics parameters
      {
        displayName: 'Metrics',
        name: 'metrics',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['logMetrics'],
          },
        },
        default: '',
        placeholder: 'r2_score,mse,mae',
        description: 'Comma-separated list of metric names to log from input data',
        required: true,
      },
      // Log Parameters parameters
      {
        displayName: 'Parameters',
        name: 'parameters',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['logParams'],
          },
        },
        default: '',
        placeholder: 'learning_rate,n_estimators,max_depth',
        description: 'Comma-separated list of parameter names to log from input data',
        required: true,
      },
      // Log Model parameters
      {
        displayName: 'Model Type',
        name: 'modelType',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['logModel'],
          },
        },
        options: [
          {
            name: 'Linear Regression',
            value: 'linear_regression',
          },
          {
            name: 'Logistic Regression',
            value: 'logistic_regression',
          },
          {
            name: 'Random Forest',
            value: 'random_forest',
          },
          {
            name: 'Custom',
            value: 'custom',
          },
        ],
        default: 'linear_regression',
        description: 'Type of scikit-learn model',
      },
      {
        displayName: 'Model Data Field',
        name: 'modelDataField',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['logModel'],
          },
        },
        default: 'model',
        description: 'Field name containing the model JSON data',
      },
      {
        displayName: 'Model Name',
        name: 'modelName',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['logModel'],
          },
        },
        default: 'sklearn-model',
        description: 'Name to save the model as in MLflow',
      },
      // MLflow connection settings
      {
        displayName: 'MLflow Tracking URI',
        name: 'trackingUri',
        type: 'string',
        default: 'http://localhost:5000',
        description: 'MLflow tracking server URI',
      },
      {
        displayName: 'Python Path',
        name: 'pythonPath',
        type: 'string',
        default: 'python3',
        description: 'Path to Python executable with MLflow installed',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const operation = this.getNodeParameter('operation', 0) as string;
    const pythonPath = this.getNodeParameter('pythonPath', 0) as string;
    const trackingUri = this.getNodeParameter('trackingUri', 0) as string;

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        let pythonScript = '';
        let scriptArgs: string[] = [];

        if (operation === 'startRun') {
          const experimentName = this.getNodeParameter('experimentName', itemIndex) as string;
          const runName = this.getNodeParameter('runName', itemIndex) as string;

          pythonScript = `
import json
import sys
import mlflow

# Set tracking URI
mlflow.set_tracking_uri('${trackingUri}')

# Set experiment
mlflow.set_experiment('${experimentName}')

# Start run
run = mlflow.start_run(run_name='${runName}' if '${runName}' else None)

result = {
    'run_id': run.info.run_id,
    'experiment_id': run.info.experiment_id,
    'run_name': run.info.run_name,
    'artifact_uri': run.info.artifact_uri,
    'status': 'RUNNING'
}

print(json.dumps(result))
`;
        } else if (operation === 'logMetrics') {
          const metricsStr = this.getNodeParameter('metrics', itemIndex) as string;
          const metricNames = metricsStr.split(',').map((m) => m.trim());

          // Extract metrics from input data
          const metrics: Record<string, number> = {};
          metricNames.forEach((name) => {
            const value = items[itemIndex].json[name];
            if (value !== undefined && value !== null) {
              metrics[name] = parseFloat(String(value));
            }
          });

          pythonScript = `
import json
import sys
import mlflow

# Set tracking URI
mlflow.set_tracking_uri('${trackingUri}')

# Get metrics from arguments
metrics = json.loads(sys.argv[1])

# Log metrics
for key, value in metrics.items():
    mlflow.log_metric(key, value)

result = {
    'logged_metrics': metrics,
    'status': 'SUCCESS'
}

print(json.dumps(result))
`;
          scriptArgs = [JSON.stringify(metrics)];

        } else if (operation === 'logParams') {
          const paramsStr = this.getNodeParameter('parameters', itemIndex) as string;
          const paramNames = paramsStr.split(',').map((p) => p.trim());

          // Extract parameters from input data
          const params: Record<string, string> = {};
          paramNames.forEach((name) => {
            const value = items[itemIndex].json[name];
            if (value !== undefined && value !== null) {
              params[name] = String(value);
            }
          });

          pythonScript = `
import json
import sys
import mlflow

# Set tracking URI
mlflow.set_tracking_uri('${trackingUri}')

# Get parameters from arguments
params = json.loads(sys.argv[1])

# Log parameters
for key, value in params.items():
    mlflow.log_param(key, value)

result = {
    'logged_params': params,
    'status': 'SUCCESS'
}

print(json.dumps(result))
`;
          scriptArgs = [JSON.stringify(params)];

        } else if (operation === 'logModel') {
          const modelType = this.getNodeParameter('modelType', itemIndex) as string;
          const modelDataField = this.getNodeParameter('modelDataField', itemIndex) as string;
          const modelName = this.getNodeParameter('modelName', itemIndex) as string;

          const modelData = items[itemIndex].json[modelDataField];
          if (!modelData) {
            throw new NodeOperationError(
              this.getNode(),
              `Model data field '${modelDataField}' not found in item`,
              { itemIndex }
            );
          }

          pythonScript = `
import json
import sys
import mlflow
import mlflow.sklearn
from sklearn.linear_model import LinearRegression
import numpy as np
import pickle
import base64

# Set tracking URI
mlflow.set_tracking_uri('${trackingUri}')

# Get model data
model_data = json.loads(sys.argv[1])

# Reconstruct model from coefficients and intercept
model = LinearRegression()
model.coef_ = np.array(model_data['coefficients'])
model.intercept_ = model_data['intercept']

# Log model
mlflow.sklearn.log_model(model, '${modelName}')

result = {
    'model_name': '${modelName}',
    'model_type': '${modelType}',
    'status': 'SUCCESS'
}

print(json.dumps(result))
`;
          scriptArgs = [JSON.stringify(modelData)];

        } else if (operation === 'endRun') {
          pythonScript = `
import json
import mlflow

# Set tracking URI
mlflow.set_tracking_uri('${trackingUri}')

# End the current run
mlflow.end_run()

result = {
    'status': 'ENDED'
}

print(json.dumps(result))
`;
        }

        // Execute Python script
        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const args = ['-c', pythonScript, ...scriptArgs];
          const python = spawn(pythonPath, args);
          let output = '';
          let errorOutput = '';

          python.stdout.on('data', (data: Buffer) => {
            output += data.toString();
          });

          python.stderr.on('data', (data: Buffer) => {
            errorOutput += data.toString();
          });

          python.on('close', (code: number) => {
            if (code !== 0) {
              reject(new Error(`Python script failed: ${errorOutput}`));
            } else {
              resolve(output.trim());
            }
          });
        });

        const result = JSON.parse(resultData);

        returnData.push({
          json: {
            ...items[itemIndex].json,
            mlflow_result: result,
          },
        });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: (error as Error).message,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

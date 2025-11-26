import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class SklearnTfidfVectorizer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Sklearn TF-IDF Vectorizer',
    name: 'sklearnTfidfVectorizer',
    icon: 'file:sklearn.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Convert text to TF-IDF feature vectors using scikit-learn',
    defaults: {
      name: 'Sklearn TF-IDF Vectorizer',
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
            description: 'Fit vectorizer and transform text',
            action: 'Fit and transform',
          },
          {
            name: 'Transform',
            value: 'transform',
            description: 'Transform using a fitted vectorizer',
            action: 'Transform',
          },
        ],
        default: 'fitTransform',
      },
      {
        displayName: 'Text Column',
        name: 'textColumn',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: '',
        placeholder: 'text',
        description: 'Name of the column containing text',
        required: true,
      },
      {
        displayName: 'Max Features',
        name: 'maxFeatures',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: 100,
        description: 'Maximum number of features (vocabulary size)',
      },
      {
        displayName: 'N-gram Range Min',
        name: 'ngramMin',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: 1,
        description: 'Minimum n-gram length',
      },
      {
        displayName: 'N-gram Range Max',
        name: 'ngramMax',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: 1,
        description: 'Maximum n-gram length',
      },
      {
        displayName: 'Stop Words',
        name: 'stopWords',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        options: [
          { name: 'None', value: 'none' },
          { name: 'English', value: 'english' },
        ],
        default: 'english',
        description: 'Stop words to remove',
      },
      {
        displayName: 'Lowercase',
        name: 'lowercase',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['fitTransform'],
          },
        },
        default: true,
        description: 'Whether to convert text to lowercase',
      },
      {
        displayName: 'Vectorizer Data',
        name: 'vectorizerData',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        description: 'JSON string containing the fitted vectorizer',
        required: true,
      },
      {
        displayName: 'Text Column',
        name: 'transformTextColumn',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['transform'],
          },
        },
        default: '',
        placeholder: 'text',
        description: 'Name of the column containing text',
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
        const textColumn = this.getNodeParameter('textColumn', 0) as string;
        const maxFeatures = this.getNodeParameter('maxFeatures', 0) as number;
        const ngramMin = this.getNodeParameter('ngramMin', 0) as number;
        const ngramMax = this.getNodeParameter('ngramMax', 0) as number;
        const stopWords = this.getNodeParameter('stopWords', 0) as string;
        const lowercase = this.getNodeParameter('lowercase', 0) as boolean;

        const texts = items.map((item, idx) => {
          const value = item.json[textColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Text column '${textColumn}' not found`, { itemIndex: idx });
          }
          return String(value);
        });

        const pythonScript = `
import json
import sys
from sklearn.feature_extraction.text import TfidfVectorizer

texts = json.loads(sys.argv[1])

vectorizer = TfidfVectorizer(
    max_features=${maxFeatures},
    ngram_range=(${ngramMin}, ${ngramMax}),
    stop_words=${ stopWords === 'none' ? 'None' : `'${stopWords}'`},
    lowercase=${lowercase ? 'True' : 'False'}
)

tfidf_matrix = vectorizer.fit_transform(texts)
feature_names = vectorizer.get_feature_names_out().tolist()

result = {
    'tfidf': tfidf_matrix.toarray().tolist(),
    'feature_names': feature_names,
    'vocabulary': vectorizer.vocabulary_,
    'idf': vectorizer.idf_.tolist(),
    'max_features': ${maxFeatures},
    'ngram_range': [${ngramMin}, ${ngramMax}],
    'stop_words': ${stopWords === 'none' ? 'None' : `'${stopWords}'`},
    'lowercase': ${lowercase ? 'True' : 'False'}
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(texts)]);
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

          // Add TF-IDF values as sparse representation (top features)
          const tfidfRow = result.tfidf[i];
          const nonZeroFeatures: Record<string, number> = {};
          tfidfRow.forEach((value: number, idx: number) => {
            if (value > 0) {
              nonZeroFeatures[result.feature_names[idx]] = value;
            }
          });

          newJson.tfidf_features = nonZeroFeatures;
          newJson.tfidf_vector = tfidfRow;

          if (i === 0) {
            newJson.vectorizer = resultData;
            newJson.vocabulary_size = result.feature_names.length;
            newJson.feature_names = result.feature_names;
          }

          returnData.push({ json: newJson });
        }

      } else if (operation === 'transform') {
        const vectorizerDataStr = this.getNodeParameter('vectorizerData', 0) as string;
        const textColumn = this.getNodeParameter('transformTextColumn', 0) as string;
        const vectorizerInfo = JSON.parse(vectorizerDataStr);

        const texts = items.map((item, idx) => {
          const value = item.json[textColumn];
          if (value === undefined || value === null) {
            throw new NodeOperationError(this.getNode(), `Text column '${textColumn}' not found`, { itemIndex: idx });
          }
          return String(value);
        });

        const pythonScript = `
import json
import sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

texts = json.loads(sys.argv[1])
vectorizer_data = json.loads(sys.argv[2])

vectorizer = TfidfVectorizer(
    max_features=vectorizer_data['max_features'],
    ngram_range=tuple(vectorizer_data['ngram_range']),
    stop_words=vectorizer_data['stop_words'],
    lowercase=vectorizer_data['lowercase']
)

# Manually set vocabulary and idf
vectorizer.vocabulary_ = vectorizer_data['vocabulary']
vectorizer.idf_ = np.array(vectorizer_data['idf'])
vectorizer._tfidf._idf_diag = np.diag(vectorizer.idf_)

tfidf_matrix = vectorizer.transform(texts)
feature_names = list(vectorizer_data['vocabulary'].keys())

result = {
    'tfidf': tfidf_matrix.toarray().tolist(),
    'feature_names': sorted(feature_names, key=lambda x: vectorizer_data['vocabulary'][x])
}

print(json.dumps(result))
`;

        const { spawn } = require('child_process');
        const resultData = await new Promise<string>((resolve, reject) => {
          const python = spawn(pythonPath, ['-c', pythonScript, JSON.stringify(texts), vectorizerDataStr]);
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

          const tfidfRow = result.tfidf[i];
          const nonZeroFeatures: Record<string, number> = {};
          tfidfRow.forEach((value: number, idx: number) => {
            if (value > 0) {
              nonZeroFeatures[result.feature_names[idx]] = value;
            }
          });

          newJson.tfidf_features = nonZeroFeatures;
          newJson.tfidf_vector = tfidfRow;

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

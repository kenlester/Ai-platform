import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true
});

// Load schemas
const communicationSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../docs/schemas/ai_communication.schema.json'), 'utf8')
);
const apiOptimizationSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../docs/schemas/api_optimization.schema.json'), 'utf8')
);
const patternRecognitionSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../docs/schemas/pattern_recognition.schema.json'), 'utf8')
);

// Add schemas to validator
ajv.addSchema(communicationSchema, 'communication');
ajv.addSchema(apiOptimizationSchema, 'api_optimization');
ajv.addSchema(patternRecognitionSchema, 'pattern_recognition');

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export async function validateSchema(data: any, path: string): Promise<ValidationResult> {
  let schemaName: string;

  // Map endpoints to schemas
  switch (path) {
    case '/patterns':
      schemaName = 'pattern_recognition';
      break;
    case '/communicate':
      schemaName = 'communication';
      break;
    case '/optimize':
      schemaName = 'api_optimization';
      break;
    default:
      return {
        valid: false,
        errors: [`No schema found for path: ${path}`]
      };
  }

  const validate = ajv.getSchema(schemaName);
  
  if (!validate) {
    return {
      valid: false,
      errors: [`Schema ${schemaName} not found`]
    };
  }

  const valid = validate(data);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors?.map((err: { instancePath: string; message: string }) => 
        `${err.instancePath} ${err.message}`
      ) || ['Unknown validation error']
    };
  }

  return {
    valid: true,
    errors: []
  };
}

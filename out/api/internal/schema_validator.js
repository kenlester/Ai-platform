"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = void 0;
const ajv_1 = __importDefault(require("ajv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ajv = new ajv_1.default({
    allErrors: true,
    removeAdditional: true,
    useDefaults: true
});
// Load schemas
const communicationSchema = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../docs/schemas/ai_communication.schema.json'), 'utf8'));
const apiOptimizationSchema = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../docs/schemas/api_optimization.schema.json'), 'utf8'));
const patternRecognitionSchema = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../../docs/schemas/pattern_recognition.schema.json'), 'utf8'));
// Add schemas to validator
ajv.addSchema(communicationSchema, 'communication');
ajv.addSchema(apiOptimizationSchema, 'api_optimization');
ajv.addSchema(patternRecognitionSchema, 'pattern_recognition');
async function validateSchema(data, path) {
    let schemaName;
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
            errors: validate.errors?.map((err) => `${err.instancePath} ${err.message}`) || ['Unknown validation error']
        };
    }
    return {
        valid: true,
        errors: []
    };
}
exports.validateSchema = validateSchema;
//# sourceMappingURL=schema_validator.js.map
import fs from 'node:fs';
import path from 'node:path';
import { openApiDefinition } from '../src/openapi/definition';

const output = path.resolve(__dirname, '../openapi.json');
fs.writeFileSync(output, `${JSON.stringify(openApiDefinition, null, 2)}\n`);
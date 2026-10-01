import fs from 'node:fs';
import path from 'node:path';
import definition from '../src/openapi/definition';

const output = path.resolve(process.cwd(), 'openapi.json');
fs.writeFileSync(output, `${JSON.stringify(definition, null, 2)}\n`);

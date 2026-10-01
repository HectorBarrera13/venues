const fs = require('node:fs');
const path = require('node:path');
const definition = require('../src/openapi/definition');

const output = path.resolve(__dirname, '../openapi.json');
fs.writeFileSync(output, `${JSON.stringify(definition, null, 2)}\n`);

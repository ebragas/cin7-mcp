// Fails when the version in package.json, the bundle manifest and the server disagree, so a half-done bump never ships.
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const versions = {
    'package.json': JSON.parse(read('package.json')).version,
    'bundle/manifest.json': JSON.parse(read('bundle/manifest.json')).version,
    'src/index.ts': read('src/index.ts').match(/name: 'cin7-core', version: '([^']+)'/)?.[1]
};

const distinct = new Set(Object.values(versions));
if (distinct.size !== 1 || distinct.has(undefined)) {
    console.error('Version mismatch:', versions);
    process.exit(1);
}
console.log([...distinct][0]);

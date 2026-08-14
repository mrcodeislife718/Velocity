import path from 'node:path';
import { scaffoldPlatformProject } from '../src/index.js';
const [target, root] = process.argv.slice(2);
if(!target||!root) throw new Error('usage: node test/generate-platform.mjs <target> <root>');
const result=await scaffoldPlatformProject(target,path.resolve(root));
console.log(JSON.stringify(result));

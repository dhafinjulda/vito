import {build} from 'vite';
import {resolve} from 'node:path';
await build({configFile:false,build:{outDir:'.benchmarks/hair-warmup',emptyOutDir:true,lib:{entry:resolve('scripts/benchmark-hair-warmup.worker.ts'),name:'HairWarmupExperiment',formats:['iife'],fileName:()=> 'worker.js'}}});

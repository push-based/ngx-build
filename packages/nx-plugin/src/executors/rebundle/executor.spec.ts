import { ExecutorContext } from '@nx/devkit';

import { RebundleExecutorSchema } from './schema';
import executor from './executor';

const options: RebundleExecutorSchema = {
  main: '',
  targetOutputPath: '',
  outputPath: ''
};
const context: ExecutorContext = {
  root: '',
  cwd: process.cwd(),
  isVerbose: false,
};

describe('Rebundle Executor', () => {
  it('can run', async () => {
    const output = await executor(options, context);
    expect(output.success).toBe(true);
  });
});

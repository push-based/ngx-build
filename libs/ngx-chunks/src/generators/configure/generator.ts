import { Tree } from '@nx/devkit';
import { ConfigureGeneratorSchema } from './schema';

export async function configureGenerator(
  tree: Tree,
  options: ConfigureGeneratorSchema
) {
  void tree;
  void options;
}

export default configureGenerator;

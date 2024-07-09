import { createHash } from 'crypto';
import { ExecutorContext, readTargetOptions } from "@nx/devkit";
import { RebundleExecutorSchema } from "../schema";
import { Metafile } from "esbuild";
import { join } from "node:path";
import { rm } from "fs-extra";

export function hashFromOutputPaths(paths: string[]): string {
    return createHash('sha256').update(paths.join('')).digest('hex').substring(0, 8).toUpperCase();
}

interface ExecutorConfiguration {
    main: string;
    targetOutputPath: string;
}

function extractConfigurationFromTarget(target: string, context: ExecutorContext): Partial<ExecutorConfiguration> {
    const projectsConfigurations = context.projectsConfigurations;
    if (!projectsConfigurations) {
        throw new Error('Unable to get the projectsConfigurations from the executor context');
    }
    const projectName = context.projectName;
    if (!projectName) {
        throw new Error('Unable to get the projectName from the executor context');
    }
    const projectTargets = projectsConfigurations.projects[projectName].targets;
    if (!projectTargets) {
        throw new Error('Unable to get the projectTargets from the executor context');
    }
    const targetOption = projectTargets[target];
    if (!targetOption) {
        throw new Error(`Unable to get the target ${target} from the executor context`);
    }
    const targetExecutor = targetOption.executor;
    if (!targetExecutor) {
        throw new Error(`Unable to get the target executor from the executor context, extracted ${targetExecutor}`);
    }
    const SUPPORTED_TARGETS = ["@angular-devkit/build-angular:browser-esbuild"];
    if (!SUPPORTED_TARGETS.includes(targetExecutor)) {
        throw new Error(`The provided target ${target} uses the unsupported executor ${targetExecutor}, supported executors are ${SUPPORTED_TARGETS.join(', ')}`);
    }
    const targetOptions = readTargetOptions({ project: projectName, target }, context);
    return {
        main: targetOptions["main"],
        targetOutputPath: targetOptions["outputPath"],
    }
}

export function configOptions(options: RebundleExecutorSchema, context: ExecutorContext): ExecutorConfiguration {
    const { target, main, targetOutputPath} = options;
    const targetOptions = target ? extractConfigurationFromTarget(target, context) : {};
    if (!main && !targetOptions['main']) {
        throw new Error('Unable to get the main option, it is required!. Please make sure you ether pass target or main as an option');
    }
    if (main && targetOptions['main']) {
        console.warn('Found the configuration for option main in both the options and the target options. The main in configuration options was used');
    }
    if (!targetOutputPath && !targetOptions['targetOutputPath']) {
        throw new Error('Unable to get the main option, it is required!. Please make sure you ether pass target or main as an option');
    }
    if (targetOutputPath && targetOptions['targetOutputPath']) {
        console.warn('Found the configuration for option targetOutputPath in both the options and the target options as outputPath. The main in configuration options was used');
    }
    return {
        main: main! || targetOptions['main']!,
        targetOutputPath: targetOutputPath! || targetOptions['targetOutputPath']!,
    }
}

export async function removeOldChunks(outputs: Metafile['outputs'], outputPath: string): Promise<void> {
    await Promise.all(Object.keys(outputs)
        .map((chunk) => join(outputPath, chunk))
        .map((chunk) => rm(chunk)));
}

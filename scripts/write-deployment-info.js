'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const deploymentInfo = require('../services/deploymentInfo');

const repositoryRoot = path.resolve(__dirname, '..');
const gitExecutable = process.env.GIT_EXECUTABLE || 'git';

function readGitValue(args, label) {
  try {
    return execFileSync(gitExecutable, args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error('Could not read ' + label + ' from Git: ' + detail, { cause: error });
  }
}

function main() {
  const commitHash = readGitValue(['rev-parse', 'HEAD'], 'deployment commit hash');
  const commitMessage = readGitValue(['log', '-1', '--format=%s'], 'deployment commit message');
  const metadata = deploymentInfo.createDeploymentInfo({ commitHash, commitMessage });
  deploymentInfo.writeDeploymentInfo(metadata);
  process.stdout.write('[DEPLOY] Metadata written for ' + metadata.commitHash + ' at ' + metadata.deployedAt + ' (Asia/Dhaka).\n');
}

try {
  main();
} catch (error) {
  process.stderr.write('[DEPLOY] Failed to write deployment-info.json: ' + error.message + '\n');
  process.exitCode = 1;
}

#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.join(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const manifest = {
  name: 'Bitbucket MCP',
  slug: 'bitbucket-mcp',
  version: pkg.version,
  description: pkg.description,
  homepage: pkg.homepage,
  repository: pkg.repository?.url?.replace(/^git\+/, '') || null,
  license: pkg.license,
  author: pkg.author,
  keywords: pkg.keywords,
  icon: 'https://bitbucket.org/favicon.ico',
  transport: 'stdio',
  startCommand: {
    command: 'node',
    args: ['dist/index.js']
  },
  configSchema: {
    type: 'object',
    properties: {
      BITBUCKET_URL: {
        type: 'string',
        description: 'Bitbucket API URL (defaults to https://api.bitbucket.org/2.0)',
        default: 'https://api.bitbucket.org/2.0'
      },
      BITBUCKET_TOKEN: {
        type: 'string',
        description: 'Bitbucket access token for authentication'
      },
      BITBUCKET_USERNAME: {
        type: 'string',
        description: 'Bitbucket username (used with password authentication)'
      },
      BITBUCKET_PASSWORD: {
        type: 'string',
        description: 'Bitbucket app password (used with username authentication)',
        format: 'password'
      },
      BITBUCKET_WORKSPACE: {
        type: 'string',
        description: 'Default Bitbucket workspace to use when not specified'
      },
      BITBUCKET_ENABLE_DANGEROUS: {
        type: 'string',
        description: 'Set to true to enable dangerous tools (e.g., deletions)'
      },
      BITBUCKET_LOG_DISABLE: {
        type: 'string',
        description: 'Disable file logging when set to true/1'
      },
      BITBUCKET_LOG_FILE: {
        type: 'string',
        description: 'Absolute path to a specific log file'
      },
      BITBUCKET_LOG_DIR: {
        type: 'string',
        description: 'Directory where logs will be written (default is OS-specific)'
      },
      BITBUCKET_LOG_PER_CWD: {
        type: 'string',
        description: 'When true, create a per-working-directory subfolder under BITBUCKET_LOG_DIR'
      }
    },
    oneOf: [
      { required: ['BITBUCKET_TOKEN'] },
      { required: ['BITBUCKET_USERNAME', 'BITBUCKET_PASSWORD'] }
    ]
  },
  documentation: {
    guide: 'https://github.com/modelcontextprotocol/registry/blob/main/docs/guides/publishing/publish-server.md',
    setup: 'See README.md for full configuration instructions.'
  }
};

const outputDir = path.join(rootDir, 'registry');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'bitbucket-mcp.manifest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Registry manifest updated at ${path.relative(rootDir, outputPath)}`);

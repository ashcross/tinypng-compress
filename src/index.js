#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import initCommand from './commands/init.js';
import checkCommand from './commands/check.js';
import newKeyCommand from './commands/new-key.js';
import compressFileCommand from './commands/compress.js';
import compressDirCommand from './commands/compressDir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
  .name('tinypng-compress')
  .description('CLI tool for batch image compression using TinyPNG API')
  .version(packageJson.version);

program
  .option('--init', 'Create configuration file')
  .option('--check', 'Show API key usage status')
  .option('--new-key', 'Add new API key to existing configuration')
  .option('--file <path>', 'Compress single file')
  .option('--dir <path>', 'Compress directory')
  .option('--api-key <name>', 'Specify API key to use (or "any" for auto-selection)')
  .option('--preserve-metadata', 'Keep EXIF data')
  .option('--convert <format>', 'Convert to format (webp|png|jpeg|avif|auto)')
  .option('--recursive', 'Include subdirectories when processing directory');

program.parse();

const options = program.opts();

async function main() {
  try {
    if (options.init) {
      await initCommand();
      return;
    }

    if (options.check) {
      await checkCommand();
      return;
    }

    if (options.newKey) {
      await newKeyCommand();
      return;
    }

    if (options.file) {
      const compressionOptions = {
        preserveMetadata: options.preserveMetadata,
        convert: options.convert
      };
      
      await compressFileCommand(options.file, options.apiKey, compressionOptions);
      return;
    }

    if (options.dir) {
      const compressionOptions = {
        preserveMetadata: options.preserveMetadata,
        convert: options.convert,
        recursive: options.recursive
      };
      
      await compressDirCommand(options.dir, options.apiKey, compressionOptions);
      return;
    }

    if (Object.keys(options).length === 0) {
      program.help();
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
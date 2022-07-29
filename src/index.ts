#!/usr/bin/env node

import * as yargs from 'yargs';
import * as dotenv from 'dotenv';

export * from './lib';
dotenv.config();

yargs
  .commandDir('cmds')
  .help()
  .demandCommand()
  .argv;

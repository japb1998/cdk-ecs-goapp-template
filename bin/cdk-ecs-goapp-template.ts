#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkEcsGoappTemplateStack } from '../lib/cdk-ecs-goapp-template-stack';

const app = new cdk.App();
const stage = process.env['STAGE'] || 'dev';
const stackName = `ecs-golang-template-${stage}`;
new CdkEcsGoappTemplateStack(app, 'CdkEcsGoappTemplateStack', {
  stackName
});
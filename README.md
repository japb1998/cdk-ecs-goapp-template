# CDK ECS GO APP

this is a CDK project that will include a golang app being deployed to ECS.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## the app folder will include a series of instrumented golang apps 
* otel-honeycomb-server - instrumented to send traces to honeycomb (cloud)
* otel-jaeger - instrumented to send tracer jaeger within the local environment or same network.
* otel-x-ray-server - instrumented to send traces to aws-otel-side-car which will send traces and logs to x-ray.
## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
* `make deploy`     deploys cdk app
- npm install -g aws-cdk-lib
- npx aws-cdk init app --language typescript
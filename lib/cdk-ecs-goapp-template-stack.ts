import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ecsp from "aws-cdk-lib/aws-ecs-patterns";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Vpc } from "./constructs/vpc";
import { SubnetType } from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Duration } from "aws-cdk-lib";
import { Effect } from "aws-cdk-lib/aws-iam";

export class CdkEcsGoappTemplateStack extends cdk.Stack {
  stage = process.env["STAGE"] ?? "dev";

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // this gives my task all permissions to dynamo
    const dynamoPolicy = new iam.Policy(this, "DynamoDBPolicy", {
      policyName: "dynamoAccess",
      statements: [
        new iam.PolicyStatement({
          actions: ["dynamo:*"],
          resources: ["*"],
          effect: iam.Effect.ALLOW,
        }),
      ],
    });

    //OTEL Policy
    const otelPolicy = new iam.Policy(this, 'otelPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "logs:PutLogEvents",
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:DescribeLogStreams",
            "logs:DescribeLogGroups",
            "xray:PutTraceSegments",
            "xray:PutTelemetryRecords",
            "xray:GetSamplingRules",
            "xray:GetSamplingTargets",
            "xray:GetSamplingStatisticSummaries",
            "ssm:GetParameters",
          ],
          effect: Effect.ALLOW,
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: [
            "dynamodb:*",
          ],
          effect: Effect.ALLOW,
          resources: ['*'],
        }),
      ],
    });
    const taskRole = new iam.Role(this, "TaskRole", {
      description: "role for ecs task",
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });

    taskRole.attachInlinePolicy(dynamoPolicy);
    taskRole.attachInlinePolicy(otelPolicy);
    /**
     * Custom Vpc
     */
    const { vpc } = new Vpc(this, "CustomVpc", {
      name: "customVpc",
      stage: this.stage,
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: "public",
          cidrMask: 24,
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: "private",
          cidrMask: 24,
        },
        // uncomment if infrastructure with isolated resources is needed.
        // {
        //   subnetType: SubnetType.PRIVATE_ISOLATED,
        //   name: 'private',
        // cidrMask: 24,
        // }
      ],
    });


    /**
     * Application Load Balancer Sg
     */
    const loadBalancerSg = new ec2.SecurityGroup(this, "loadBalancerSg", {
      securityGroupName: `ecs-goapp-lb-sg-${this.stage}`,
      vpc: vpc,
    });

    loadBalancerSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "allow http traffic"
    );
    loadBalancerSg.addIngressRule(
      ec2.Peer.anyIpv6(),
      ec2.Port.tcp(80),
      "allow http traffic"
    );

    /**
     * Task Security Group
     */
    const taskSg = new ec2.SecurityGroup(this, "TaskSecurityGroup", {
      securityGroupName: `ecs-goapp-sg-task-${this.stage}`,
      vpc: vpc,
    });
    taskSg.addIngressRule(
      ec2.Peer.securityGroupId(loadBalancerSg.securityGroupId),
      ec2.Port.tcp(8080),
      "allow load balancer to connect"
    );

    const lb = new elbv2.ApplicationLoadBalancer(this, "lb", {
      vpc,
      internetFacing: true,
      securityGroup: loadBalancerSg,
    });

    // golang app task definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, "goApp", {
      taskRole,
      cpu: 512,
      memoryLimitMiB: 1024
    });

    taskDefinition.addContainer("goApp", {
      containerName: `golang-sample-app-${this.stage}`,
      image: ecs.ContainerImage.fromAsset("./app", {
        file: "Dockerfile"
      }),
      memoryLimitMiB: 512,
      cpu: 256,
      portMappings: [{ containerPort: 8080, hostPort: 8080 }],
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "go-template-app",
      }),
      environment: {
        OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME as string,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'localhost:4317',
        XRAY_ENDPOINT: 'http://localhost:2000'
      }
    });

    //ADOT container
    
    //uncomment if instrumenting with ADOT
    taskDefinition.addContainer("adotContainer", {
      containerName: `aws-otel-collector-${this.stage}`,
      command: ["--config=/etc/ecs/ecs-default-config.yaml"],
      image: ecs.ContainerImage.fromRegistry("amazon/aws-otel-collector:latest"),
      memoryLimitMiB: 512,
      essential: true,
      cpu: 256,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "aws-otel-collector",
      }),
      healthCheck: { // Disable health check
        command: ['CMD','/healthcheck'],
        interval: Duration.seconds(10),
        retries: 3,
        startPeriod: Duration.seconds(5),
        timeout: Duration.seconds(5) 
      }
    });


    /* 
    
    this will create:
    * Amazon ECS cluster

    * Amazon VPC and Amazon EC2 instances

    * Auto Scaling group

    * Application Load Balancer

    * IAM roles and policies
    */
    const service = new ecsp.ApplicationLoadBalancedFargateService(
      this,
      "MyWebServer",
      {
        serviceName: `ecs-golang-template-${this.stage}`,
        desiredCount: 1,
        taskDefinition,
        publicLoadBalancer: true, // internet facing or not
        securityGroups: [taskSg],
        vpc: vpc, // if custom vpc is needed.
        enableExecuteCommand: true,
        loadBalancer: lb,
        // taskSubnets: {
        //   subnets: [ec2.Subnet.fromSubnetId(this, 'subnet', 'VpcISOLATEDSubnet1Subnet80F07FA0')],
        // }, // if I needed to define my subnets.
        // domainName: 'TBD'
        // certificate: 'TBD'
      }
    );
  }
}

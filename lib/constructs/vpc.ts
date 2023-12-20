import { Construct } from "constructs";
import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * @params {string} cidr  ex. 10.0.0.0/16
 */
export interface VpcProps {
    name: string,
    stage: string,
    cidr?: string,
    maxAzs: number,
    subnetConfiguration: ec2.SubnetConfiguration[]
}

/**
 * Vpc Construct.
 */
export class Vpc extends Construct {
    vpc: ec2.Vpc;
    constructor(scope: Construct, id: string, props: VpcProps) {
      super(scope, id);
    const {
        subnetConfiguration,
         maxAzs
    } = props;

    this.vpc = new ec2.Vpc(this, props.name, {
        ipAddresses: props.cidr ? ec2.IpAddresses.cidr(props.cidr) : undefined,
        subnetConfiguration,
        maxAzs,
    });

    }
  }
profile=personal
stage=dev
service=cdk-ecs-golang-app
deploy:
	OTEL_SERVICE_NAME=$(service) STAGE=$(stage) npm run cdk -- deploy --profile $(profile)

destroy:
STAGE=$(stage) npm run cdk -- destroy --profile $(profile)
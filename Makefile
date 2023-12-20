profile=personal
stage=dev
deploy:
	STAGE=$(stage) npm run cdk -- deploy --profile $(profile)

destroy:
STAGE=$(stage) npm run cdk -- destroy --profile $(profile)
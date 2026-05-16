# Cohort 14 — AWS Infrastructure

This directory contains the CloudFormation template and supporting config files for the Cohort 14 ITSM platform infrastructure. Run this once per environment before any application deployment.

## Files

| File | Purpose |
|------|---------|
| `cohort14-infra.yaml` | Main CloudFormation template — all AWS resources |
| `cloudwatch-agent-config.json` | CloudWatch Agent configuration (reference copy; also embedded in UserData) |
| `amplify.yml` | Amplify build spec (place in repo root or reference in Amplify console) |

## Prerequisites

1. **AWS CLI** configured with credentials that have permissions to create all resources in the template (IAM, EC2, ELB, ACM, Cognito, Amplify, DLM, CloudWatch, VPC endpoints).
2. **EC2 Key Pair** created in the target region — you will pass the key pair name as a parameter.
3. **Domain name** with DNS management access — you need to add:
   - A **CNAME** record for `ApiDomain` pointing to the ALB DNS output (for ACM validation and API routing).
4. **GitHub Personal Access Token** (or equivalent) with `repo` scope — passed as `AmplifyGitHubToken`.
5. **AWSDataLifecycleManagerDefaultRole** IAM role must exist in the account (auto-created by AWS when you first use DLM in the console; or create manually).
6. **Amazon Bedrock** — enable **Claude 3 Haiku** and **Titan Text Embeddings V2** access (console → Bedrock → Model access) in the deployment region before calling `InvokeModel`.

The EC2 IAM role grants **`bedrock:InvokeModel`** only for foundation models `anthropic.claude-3-haiku-20240307-v1:0` and `amazon.titan-embed-text-v2:0` (see **`BedrockFoundationModelsInvoke`** in `cohort14-infra.yaml`).

## Deployment

### Step 1 — Deploy the CloudFormation stack

```bash
aws cloudformation deploy \
  --template-file infra/cohort14-infra.yaml \
  --stack-name cohort14-production \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Env=production \
    InstanceType=t3.small \
    ApiDomain=api.your-domain.com \
    FrontendDomain=app.your-domain.com \
    KeyPairName=your-key-pair \
    RepoUrl=https://github.com/your-org/your-repo \
    AmplifyBranch=main \
    AmplifyGitHubToken=ghp_xxxxxxxxxxxx \
    EbsVolumeSize=20
```

> The stack will pause at the ACM certificate resource until DNS validation completes (usually 1–5 minutes after you add the CNAME). Stack creation typically takes 10–20 minutes total.

### Step 2 — Add DNS records

After the stack starts creating, two DNS records are needed:

1. **ACM validation CNAME** — visible in the ACM console under the certificate for `ApiDomain`. Add to your DNS provider. The stack will not complete until this validates.
2. **API domain CNAME** — once the stack completes, point `ApiDomain` to the `AlbDns` output value.

### Step 3 — Retrieve stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name cohort14-production \
  --query "Stacks[0].Outputs" \
  --output table
```

Key outputs to capture:

| Output Key | Used as |
|------------|---------|
| `CognitoUserPoolId` | `COGNITO_USER_POOL_ID` on EC2 `.env` |
| `CognitoClientId` | `COGNITO_CLIENT_ID` on EC2 `.env` |
| `CognitoDomain` | `COGNITO_DOMAIN` on EC2 `.env` |
| `CognitoRedirectUri` | `COGNITO_REDIRECT_URI` on EC2 `.env` |
| `ElasticIp` | SSH target; CORS allowlist reference |
| `AlbDns` | CNAME target for `ApiDomain` |
| `AmplifyAppId` | Reference for Amplify console |
| `AmplifyDefaultDomain` | Amplify preview URL before custom domain |

### Step 4 — Verify EC2 setup

SSH to the instance using the Elastic IP:

```bash
ssh -i ~/.ssh/your-key-pair.pem ec2-user@<ElasticIp>
```

Verify services:

```bash
# Node.js and PM2
node --version
pm2 --version

# CloudWatch Agent running
sudo systemctl status amazon-cloudwatch-agent

# Data volume mounted
df -h /data
ls /data
```

### Step 5 — Configure the application .env on EC2

Create `/home/ec2-user/app/.env` using values from the stack outputs:

```bash
PORT=4000
NODE_ENV=production
JWT_SECRET=<generate-a-strong-secret>
DB_PATH=/data/cohort14.db
DB_ENCRYPTION_KEY=<generate-a-strong-key>
FRONTEND_URL=https://<FrontendDomain>

COGNITO_USER_POOL_ID=<CognitoUserPoolId output>
COGNITO_CLIENT_ID=<CognitoClientId output>
COGNITO_CLIENT_SECRET=
COGNITO_DOMAIN=<CognitoDomain output>
COGNITO_REDIRECT_URI=<CognitoRedirectUri output>

SAML_IDP_METADATA_URL=https://login.microsoftonline.com/<tenant-id>/federationmetadata/2007-06/federationmetadata.xml
SAML_SP_ENTITY_ID=https://<ApiDomain>/saml
SAML_SP_ACS_URL=https://<ApiDomain>/auth/saml/callback
```

### Step 6 — Deploy and start the application

```bash
# Clone the repo
cd /home/ec2-user
git clone <RepoUrl> app
cd app/cohort-14

# Install dependencies
npm install --omit=dev

# Run migrations and seed
npm run migrate
npm run seed

# Start with PM2
pm2 start src/server.js --name cohort14
pm2 save
```

### Step 7 — Verify CloudWatch Logs

```bash
aws logs describe-log-streams \
  --log-group-name /cohort14/backend \
  --order-by LastEventTime \
  --descending
```

Log events should appear within 15 seconds of PM2 writing to stdout.

### Step 8 — Trigger Amplify build

```bash
aws amplify start-job \
  --app-id <AmplifyAppId output> \
  --branch-name main \
  --job-type RELEASE
```

---

## Post-Deploy Checklist

- [ ] ACM certificate status is `ISSUED` in the ACM console
- [ ] ALB target group shows the EC2 instance as **healthy**
- [ ] `https://<ApiDomain>/graphql` returns a GraphQL response (400 or 200)
- [ ] CloudWatch log group `/cohort14/backend` is receiving log events
- [ ] EBS snapshot lifecycle policy is active (check DLM console)
- [ ] Amplify build succeeded; front end accessible at Amplify domain
- [ ] Cognito Hosted UI reachable at `<CognitoDomain>/login`
- [ ] No access keys present on EC2: `env | grep -i aws_access` should return nothing

## Stack Update

To update parameters (e.g. change instance type):

```bash
aws cloudformation deploy \
  --template-file infra/cohort14-infra.yaml \
  --stack-name cohort14-production \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides InstanceType=t3.medium \
  --no-fail-on-empty-changeset
```

## Stack Teardown

> **Warning:** The EBS data volume has `DeletionPolicy: Retain`. It will NOT be deleted when the stack is torn down — manual deletion is required after confirming data is backed up.

```bash
aws cloudformation delete-stack --stack-name cohort14-production
```

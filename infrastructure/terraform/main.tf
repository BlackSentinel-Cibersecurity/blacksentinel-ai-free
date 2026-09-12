terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    bucket         = "blacksentinel-terraform-state"
    key            = "ai-platform/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "blacksentinel-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "BlackSentinel"
      Component   = "AI Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ============================================================================
# VARIABLES
# ============================================================================

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "blacksentinel-ai"
}

variable "cluster_version" {
  description = "EKS cluster version"
  type        = string
  default     = "1.28"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

# ============================================================================
# VPC
# ============================================================================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "${var.cluster_name}-vpc"
  cidr = var.vpc_cidr

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "production"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = var.environment
  }
}

# ============================================================================
# EKS CLUSTER
# ============================================================================

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.21.0"

  cluster_name    = var.cluster_name
  cluster_version = var.cluster_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access = true

  eks_managed_node_groups = {
    ai_engine = {
      name           = "ai-engine-nodes"
      instance_types = ["m6i.xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 3

      labels = {
        component = "ai-engine"
      }
    }

    services = {
      name           = "service-nodes"
      instance_types = ["m6i.large"]
      min_size       = 2
      max_size       = 6
      desired_size   = 2

      labels = {
        component = "services"
      }
    }

    monitoring = {
      name           = "monitoring-nodes"
      instance_types = ["m6i.large"]
      min_size       = 2
      max_size       = 4
      desired_size   = 2

      labels = {
        component = "monitoring"
      }
    }
  }

  tags = {
    Environment = var.environment
  }
}

# ============================================================================
# REDIS (ElastiCache)
# ============================================================================

module "redis" {
  source = "./modules/elasticache"

  cluster_id      = "${var.cluster_name}-redis"
  node_type       = "cache.r6g.large"
  num_cache_nodes = 2
  engine_version  = "7.0"
  port            = 6379

  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_subnets
  allowed_security_group_ids = [module.eks.cluster_security_group_id]
}

# ============================================================================
# POSTGRESQL (RDS)
# ============================================================================

module "database" {
  source = "./modules/rds"

  identifier = "${var.cluster_name}-db"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "blacksentinel"
  username = "bsadmin"
  port     = 5432

  vpc_id                     = module.vpc.vpc_id
  subnet_ids                 = module.vpc.private_subnets
  allowed_security_group_ids = [module.eks.cluster_security_group_id]

  backup_retention_period = 30
  multi_az                = var.environment == "production"
}

# ============================================================================
# S3 BUCKETS
# ============================================================================

module "storage" {
  source = "./modules/s3"

  buckets = {
    "${var.cluster_name}-models" = {
      versioning = true
      lifecycle_rules = [{
        id      = "archive-old-models"
        enabled = true
        transition = [{
          days          = 90
          storage_class = "GLACIER"
        }]
      }]
    }
    "${var.cluster_name}-data-lake" = {
      versioning = true
      lifecycle_rules = [{
        id      = "transition-to-ia"
        enabled = true
        transition = [{
          days          = 30
          storage_class = "STANDARD_IA"
        }]
      }]
    }
    "${var.cluster_name}-audit-logs" = {
      versioning  = true
      object_lock = true
    }
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "redis_endpoint" {
  value = module.redis.endpoint
}

output "database_endpoint" {
  value = module.database.endpoint
}

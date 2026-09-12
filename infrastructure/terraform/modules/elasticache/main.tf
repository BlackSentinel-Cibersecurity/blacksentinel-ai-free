# BLACKSENTINEL AI - ElastiCache (Redis) module
#
# Didn't exist — main.tf's `module "redis" { source = "./modules/elasticache" }`
# pointed at nothing, so `terraform init` could never succeed.

variable "cluster_id" {
  type        = string
  description = "Identifier prefix for the replication group and its subnet/security group"
}

variable "node_type" {
  type        = string
  description = "ElastiCache node instance type, e.g. cache.r6g.large"
}

variable "num_cache_nodes" {
  type        = number
  description = "Number of cache clusters (nodes) in the replication group. >1 enables automatic failover."
  default     = 2
}

variable "engine_version" {
  type    = string
  default = "7.0"
}

variable "port" {
  type    = number
  default = 6379
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnets to place the cache nodes in"
}

variable "allowed_security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to reach Redis on `port` (e.g. the EKS cluster security group)"
  default     = []
}

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.cluster_id}-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  name_prefix = "${var.cluster_id}-"
  description = "Allow Redis access from trusted security groups only"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.allowed_security_group_ids
    content {
      description     = "Redis from trusted SG"
      from_port       = var.port
      to_port         = var.port
      protocol        = "tcp"
      security_groups = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = var.cluster_id
  description          = "BlackSentinel AI Redis (${var.cluster_id})"

  engine         = "redis"
  engine_version = var.engine_version
  node_type      = var.node_type
  port           = var.port

  num_cache_clusters         = var.num_cache_nodes
  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  auto_minor_version_upgrade = true
  apply_immediately          = false
}

output "endpoint" {
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
  description = "Redis primary endpoint (host only, no port)"
}

output "port" {
  value = var.port
}

output "security_group_id" {
  value = aws_security_group.this.id
}

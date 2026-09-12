# BLACKSENTINEL AI - RDS (PostgreSQL) module
#
# Didn't exist — main.tf's `module "database" { source = "./modules/rds" }`
# pointed at nothing, so `terraform init` could never succeed. Master
# password is never handled by Terraform directly (manage_master_user_password
# lets RDS create and rotate it via AWS Secrets Manager) — there was no
# password variable in main.tf's call to begin with, so this was also the
# only way this could ever have worked without one.

variable "identifier" {
  type = string
}

variable "engine" {
  type    = string
  default = "postgres"
}

variable "engine_version" {
  type = string
}

variable "instance_class" {
  type = string
}

variable "allocated_storage" {
  type = number
}

variable "max_allocated_storage" {
  type = number
}

variable "db_name" {
  type = string
}

variable "username" {
  type = string
}

variable "port" {
  type    = number
  default = 5432
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnets for the DB subnet group"
}

variable "allowed_security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to reach Postgres on `port` (e.g. the EKS cluster security group)"
  default     = []
}

variable "backup_retention_period" {
  type    = number
  default = 7
}

variable "multi_az" {
  type    = bool
  default = false
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.identifier}-subnet-group"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "this" {
  name_prefix = "${var.identifier}-"
  description = "Allow Postgres access from trusted security groups only"
  vpc_id      = var.vpc_id

  dynamic "ingress" {
    for_each = var.allowed_security_group_ids
    content {
      description     = "Postgres from trusted SG"
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

resource "aws_db_instance" "this" {
  identifier     = var.identifier
  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.username
  port     = var.port

  # AWS creates and rotates the master password in Secrets Manager —
  # Terraform never sees or stores the actual value.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]

  multi_az                  = var.multi_az
  backup_retention_period   = var.backup_retention_period
  deletion_protection       = var.multi_az # proxy for "this is production"
  skip_final_snapshot       = !var.multi_az
  final_snapshot_identifier = var.multi_az ? "${var.identifier}-final" : null

  auto_minor_version_upgrade = true
  apply_immediately          = false
}

output "endpoint" {
  value       = aws_db_instance.this.endpoint
  description = "host:port"
}

output "master_user_secret_arn" {
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
  description = "Secrets Manager ARN holding the auto-generated master password"
}

output "security_group_id" {
  value = aws_security_group.this.id
}

# BLACKSENTINEL AI - S3 buckets module
#
# Didn't exist — main.tf's `module "storage" { source = "./modules/s3" }`
# pointed at nothing, so `terraform init` could never succeed.

variable "buckets" {
  description = <<-EOT
    Map of bucket name -> config:
      versioning  (bool)
      object_lock (bool, optional) — must be set at bucket creation, can't be
                   added later; only meaningful with versioning enabled
      lifecycle_rules (list of { id, enabled, transition = list({ days, storage_class }) }, optional)
  EOT
  type = map(object({
    versioning  = bool
    object_lock = optional(bool, false)
    lifecycle_rules = optional(list(object({
      id      = string
      enabled = bool
      transition = list(object({
        days          = number
        storage_class = string
      }))
    })), [])
  }))
}

resource "aws_s3_bucket" "this" {
  for_each = var.buckets

  bucket              = each.key
  object_lock_enabled = each.value.object_lock
}

resource "aws_s3_bucket_versioning" "this" {
  for_each = var.buckets

  bucket = aws_s3_bucket.this[each.key].id
  versioning_configuration {
    status = each.value.versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = var.buckets

  bucket = aws_s3_bucket.this[each.key].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = var.buckets

  bucket = aws_s3_bucket.this[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = { for name, cfg in var.buckets : name => cfg if length(cfg.lifecycle_rules) > 0 }

  bucket = aws_s3_bucket.this[each.key].id

  dynamic "rule" {
    for_each = each.value.lifecycle_rules
    content {
      id     = rule.value.id
      status = rule.value.enabled ? "Enabled" : "Disabled"

      dynamic "transition" {
        for_each = rule.value.transition
        content {
          days          = transition.value.days
          storage_class = transition.value.storage_class
        }
      }
    }
  }

  # Required by the provider when versioning is configured on the bucket.
  depends_on = [aws_s3_bucket_versioning.this]
}

output "bucket_ids" {
  value = { for name, b in aws_s3_bucket.this : name => b.id }
}

output "bucket_arns" {
  value = { for name, b in aws_s3_bucket.this : name => b.arn }
}

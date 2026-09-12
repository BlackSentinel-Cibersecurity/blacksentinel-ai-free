#!/bin/bash
# ============================================================================
# BLACKSENTINEL AI - Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# ============================================================================

set -euo pipefail

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================="
echo "BLACKSENTINEL AI - Deployment"
echo "Environment: $ENVIRONMENT"
echo "============================================="

# ============================================================================
# VALIDATE
# ============================================================================

validate_prerequisites() {
    echo "🔍 Validating prerequisites..."

    command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }
    command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required for K8s deployment"; exit 1; }

    echo "✅ All prerequisites found"
}

# ============================================================================
# BUILD
# ============================================================================

build() {
    echo "🔨 Building project..."
    cd "$ROOT_DIR"
    npm install
    npm run build
    echo "✅ Build complete"
}

# ============================================================================
# DOCKER BUILD
# ============================================================================

docker_build() {
    echo "🐳 Building Docker images..."
    cd "$ROOT_DIR"
    docker compose build
    echo "✅ Docker build complete"
}

# ============================================================================
# LOCAL DEVELOPMENT
# ============================================================================

deploy_local() {
    echo "📦 Deploying locally with Docker Compose..."
    cd "$ROOT_DIR"
    docker compose up -d
    echo "✅ Local deployment complete"
    echo ""
    echo "Services:"
    echo "  - AI Engine:       http://localhost:8080"
    echo "  - Agent Orchestrator: http://localhost:8081"
    echo "  - Knowledge Graph: http://localhost:8082"
    echo "  - Memory Service:  http://localhost:8083"
    echo "  - Neo4j:           http://localhost:7474"
    echo "  - Redis:           http://localhost:6379"
    echo "  - PostgreSQL:      http://localhost:5432"
    echo "  - Prometheus:      http://localhost:9090"
    echo "  - Grafana:         http://localhost:3000"
}

# ============================================================================
# KUBERNETES
# ============================================================================

deploy_kubernetes() {
    echo "☸️  Deploying to Kubernetes..."
    cd "$ROOT_DIR"

    # Create namespace
    kubectl apply -f infrastructure/kubernetes/base/namespace.yaml

    # Apply base manifests
    kubectl apply -f infrastructure/kubernetes/base/

    # Wait for rollout
    echo "⏳ Waiting for deployment..."
    kubectl -n blacksentinel rollout status deployment/blacksentinel-ai-engine --timeout=300s

    echo "✅ Kubernetes deployment complete"
    echo ""
    kubectl -n blacksentinel get pods
    kubectl -n blacksentinel get services
}

# ============================================================================
# HELM
# ============================================================================

deploy_helm() {
    echo "⎈  Deploying with Helm..."
    cd "$ROOT_DIR"

    helm upgrade --install blacksentinel-ai \
        infrastructure/helm/charts/blacksentinel-ai \
        --namespace blacksentinel \
        --create-namespace \
        --set image.tag=$(git rev-parse --short HEAD 2>/dev/null || echo "latest") \
        --wait

    echo "✅ Helm deployment complete"
}

# ============================================================================
# TEARDOWN
# ============================================================================

teardown() {
    echo "🧹 Tearing down..."
    cd "$ROOT_DIR"
    docker compose down -v
    echo "✅ Teardown complete"
}

# ============================================================================
# MAIN
# ============================================================================

case "$ENVIRONMENT" in
    local|dev|development)
        validate_prerequisites
        build
        docker_build
        deploy_local
        ;;
    k8s|kubernetes)
        validate_prerequisites
        build
        deploy_kubernetes
        ;;
    helm)
        validate_prerequisites
        build
        deploy_helm
        ;;
    teardown)
        teardown
        ;;
    *)
        echo "Usage: $0 [local|k8s|helm|teardown]"
        exit 1
        ;;
esac

echo ""
echo "============================================="
echo "Deployment complete!"
echo "============================================="

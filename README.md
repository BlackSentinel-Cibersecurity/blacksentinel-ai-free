<div align="center">

![BlackSentinel Logo](images/logo.png)

# BLACKSENTINEL AI — Free / Open-Source Edition

> **This is the free, limited edition.** All three real agents (SOC,
> Threat Hunter, Incident Response — the only ones with real analysis
> logic; every other agent type already refuses with a clear "not
> implemented yet" rather than a fake answer) are usable here, capped at
> 50 queries per 30 days (`src/server/config/edition.ts`). For unlimited
> queries, see [blacksentinel.tech](https://blacksentinel.tech).

### Cyber Cognitive Intelligence Engine

**The Cognitive Brain of the BlackSentinel Ecosystem**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

</div>

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/BlackSentinel-Cibersecurity/blacksentinel-ai-free.git
cd ai-platform
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start with Docker Compose
docker compose up -d

# 4. Verify
curl http://localhost:8080/health
```

---

## Brand Identity

| Color | Hex | Usage |
|-------|-----|-------|
| Negro Profundo | `#0B0B0B` | Primary background |
| Negro Secundario | `#141414` | Card backgrounds |
| Gris Oscuro | `#232323` | Borders, dividers |
| Gris Medio | `#3C3C3C` | Secondary text |
| Gris Claro | `#D9D9D9` | Muted text |
| Blanco | `#FFFFFF` | Primary text |
| **Naranja Principal** | **`#FF6B00`** | Primary accent |
| Naranja Brillante | `#FF8C1A` | Hover states |
| Rojo Critico | `#EF4444` | Critical alerts |
| Verde | `#22C55E` | Success states |
| Azul | `#3B82F6` | Informational |
| Amarillo | `#FACC15` | Warning states |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI COMMAND CENTER                          │
├─────────┬─────────┬─────────┬─────────┬─────────┬───────────────┤
│   SOC   │ Threat  │   IR    │  Intel  │   Vuln  │   Identity    │
│  Agent  │ Hunter  │  Agent  │  Agent  │  Agent  │    Agent      │
├─────────┴─────────┴─────────┴─────────┴─────────┴───────────────┤
│                    REASONING LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                    DECISION LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                    MEMORY LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│                    KNOWLEDGE LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│                    PERCEPTION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Nexus │ Pulse │ Guardian │ Vault │ Vision │ Forge │ Command    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Description | Port |
|---------|-------------|------|
| `ai-engine` | Core cognitive engine | 8080 |
| `agent-orchestrator` | Multi-agent system | 8081 |
| `knowledge-graph` | Graph-based knowledge | 8082 |
| `memory-service` | Hierarchical memory | 8083 |
| `llm-orchestrator` | LLM provider management | - |
| `ai-gateway` | API gateway with security | - |
| `model-registry` | AI model lifecycle | - |
| `xai-module` | Explainable AI | - |
| `predictive-engine` | Threat prediction | - |
| `generative-ai` | Security artifact generation | - |
| `security-policy` | RBAC/ABAC/Zero Trust | - |
| `observability` | Metrics/logs/traces | - |
| `feature-store` | ML feature engineering | - |
| `data-lake` | Unified data storage | - |
| `event-bus` | Inter-service communication | - |
| `streaming-platform` | Real-time streaming | - |
| `prompt-management` | Prompt templates | - |
| `ai-command-center` | Central orchestration | - |

---

## Specialized Agents

| Agent | Responsibility |
|-------|---------------|
| SOC Agent | Alert analysis, incident prioritization |
| Threat Hunter Agent | Hypothesis generation, threat detection |
| Incident Response Agent | Playbook generation, containment |
| Threat Intelligence Agent | Intel correlation, actor analysis |
| Vulnerability Agent | CVE prioritization, risk calculation |
| Identity Agent | Privilege analysis, abuse detection |
| Endpoint Agent | Behavior analysis, anomaly detection |
| Cloud Agent | Configuration analysis, risk detection |
| Executive Agent | Business reporting, risk translation |
| Automation Agent | Workflow generation, optimization |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/query` | POST | Natural language query |
| `/api/v1/agents/:type/process` | POST | Agent-specific processing |
| `/api/v1/knowledge/search` | POST | Knowledge graph search |
| `/api/v1/memory/store` | POST | Store memory entry |
| `/api/v1/memory/retrieve` | POST | Retrieve memories |
| `/api/v1/generative/generate` | POST | Generate security artifacts |
| `/api/v1/predict/threats` | POST | Predict threats |
| `/api/v1/xai/explain` | POST | Explain decisions |
| `/api/v1/models` | GET/POST | Model registry |
| `/api/v1/reports/ciso` | POST | Generate CISO report |
| `/api/v1/auth/login` | POST | User authentication |
| `/health` | GET | Health check |
| `/metrics` | GET | Prometheus metrics |

---

## Deployment

### Local Development
```bash
docker compose up -d
```

### Kubernetes
```bash
kubectl apply -f infrastructure/kubernetes/base/
```

### Helm
```bash
helm upgrade --install blacksentinel-ai \
  infrastructure/helm/charts/blacksentinel-ai \
  --namespace blacksentinel \
  --create-namespace
```

### Terraform (AWS)
```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

---

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `8080` |
| `JWT_SECRET` | JWT secret key | Required |
| `ENCRYPTION_KEY` | Encryption key | Required |
| `REDIS_URL` | Redis URL | `redis://localhost:6379` |
| `NEO4J_URL` | Neo4j URL | `bolt://localhost:7687` |
| `POSTGRES_URL` | PostgreSQL URL | Required |

---

## Testing

```bash
npm run test:unit        # Unit tests
npm run test:integration # Integration tests
npm run test:adversarial # Security tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report
```

---

## Security

- Zero Trust architecture
- MFA/SSO enforcement
- RBAC/ABAC access control
- Prompt injection protection
- Data poisoning prevention
- Model extraction protection
- Jailbreak prevention
- Input validation and sanitization
- Immutable audit logging
- End-to-end encryption
- Rate limiting
- Tenant isolation

---

<div align="center">

**BlackSentinel AI** - Autonomous Cyber Intelligence Engine

![BlackSentinel Logo](images/logo.png)

</div>

---

## Before you run it

- This is a **technical preview** and the open-source edition of the product. It comes with no warranty and no service-level commitment: try it in a test environment first.
- It is **self-hosted**. BlackSentinel does not host it for you, and paid plans are not on sale.
- Change every default credential and secret before exposing anything to a network. Never deploy with the example values from `.env.example` or `.env.production`.
- Use it only on systems you own or are explicitly authorized to test or monitor. See the [Acceptable Use Policy](https://blacksentinel.tech/acceptable-use/).

## Support

- Bugs and questions: [open an issue](https://github.com/BlackSentinel-Cibersecurity/blacksentinel-ai-free/issues) in this repository.
- Security reports: follow [security.txt](https://blacksentinel.tech/.well-known/security.txt). Please do not open a public issue for a vulnerability.
- Everything else: BlackSentinel-tech@protonmail.com

## License

MIT. See [LICENSE](LICENSE). The BlackSentinel name and logo are not covered by the licence.

# GraphMan

A web-based GraphQL client and IDE built with Spring Boot. Features an interactive query editor, schema introspection, request management, and a Shopify AI assistant for API guidance.

![Java 21](https://img.shields.io/badge/Java-21-orange) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.1-green) ![Gradle](https://img.shields.io/badge/Gradle-8.5-blue)

## Features

- **Interactive GraphQL Editor** — CodeMirror-based editor with syntax highlighting and query beautification
- **Schema Introspection** — Automatic schema discovery, type explorer, and documentation panel with search
- **Request Management** — Save, load, update, and delete requests with persistent file-based storage
- **Authentication** — Bearer Token, Basic Auth, and API Key (custom header) support
- **Custom Headers** — Per-request and global default headers
- **Variables Support** — JSON-formatted GraphQL variables with validation
- **Shopify AI Assistant** — Streaming chat assistant for Shopify GraphQL API documentation and guidance
- **Global Settings** — Default endpoint, headers, and authentication configuration

## Prerequisites

- Java 21 (JDK)

## Getting Started

```bash
# Build
./gradlew build

# Run
./gradlew bootRun
```

The application starts on **http://localhost:8083**.

## Configuration

Edit `src/main/resources/application.properties`:

| Property | Default | Description |
|----------|---------|-------------|
| `server.port` | `8083` | Server port |
| `graphman.storage.path` | `saved-requests` | Directory for persisted requests |
| `spring.thymeleaf.cache` | `false` | Template caching (enable in production) |

Properties can be overridden at runtime:

```bash
./gradlew bootRun --args='--server.port=9000'
```

## Project Structure

```
src/main/
├── java/com/graphman/
│   ├── GraphManApplication.java        # Entry point
│   ├── config/WebConfig.java           # WebClient config (16MB buffer)
│   ├── controller/
│   │   ├── MainController.java         # Home page
│   │   ├── GraphQLController.java      # Query execution & introspection
│   │   ├── RequestController.java      # Saved request CRUD
│   │   └── ChatController.java         # Shopify AI chat (SSE)
│   ├── service/
│   │   ├── GraphQLService.java         # Query execution with auth
│   │   ├── IntrospectionService.java   # Schema introspection
│   │   ├── ShopifyAIService.java       # AI assistant integration
│   │   └── RequestStorageService.java  # File-based persistence
│   └── model/                          # Request, schema, and auth models
└── resources/
    ├── application.properties
    ├── templates/index.html            # Single-page app
    └── static/
        ├── js/app.js                   # Frontend application
        └── css/style.css               # Custom styles
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Web UI |
| `POST` | `/api/graphql/execute` | Execute a GraphQL query |
| `POST` | `/api/graphql/introspect` | Schema introspection (parsed) |
| `POST` | `/api/graphql/introspect/raw` | Raw introspection JSON |
| `GET` | `/api/requests` | List saved requests |
| `GET` | `/api/requests/{id}` | Get a saved request |
| `POST` | `/api/requests` | Save a new request |
| `PUT` | `/api/requests/{id}` | Update a request |
| `DELETE` | `/api/requests/{id}` | Delete a request |
| `POST` | `/api/chat` | Shopify AI chat (SSE stream) |

## Authentication Types

| Type | Fields | Example Use |
|------|--------|-------------|
| `NONE` | — | Public endpoints |
| `BEARER_TOKEN` | `bearerToken` | OAuth / JWT tokens |
| `BASIC_AUTH` | `basicUsername`, `basicPassword` | HTTP Basic Auth |
| `API_KEY` | `apiKeyHeader`, `apiKeyValue` | Custom header keys (e.g. `X-Shopify-Access-Token`) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2.1, Spring WebFlux, Java 21 |
| Frontend | Bootstrap 5.3.2, CodeMirror 5.65.15, Vanilla JS |
| Storage | File system (JSON) |
| Build | Gradle 8.5 |
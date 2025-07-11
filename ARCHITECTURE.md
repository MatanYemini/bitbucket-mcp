# Arquitectura Modular - Bitbucket MCP

## Descripción

Este proyecto ha sido refactorizado de una estructura monolítica (archivo único de +2000 líneas) a una arquitectura modular para mejorar la mantenibilidad, legibilidad y testing.

## Estructura del Proyecto

```
src/
├── config/                 # Configuración
│   └── bitbucket.ts        # Configuración de Bitbucket
├── schemas/                # Esquemas de validación
│   ├── common.ts           # Esquemas comunes (workspace, repo, etc.)
│   └── tools.ts            # Definiciones de herramientas MCP
├── services/               # Servicios de dominio
│   ├── index.ts            # Barrel exports
│   ├── base.ts             # Servicio base con cliente API
│   ├── repository.ts       # Operaciones de repositorios
│   ├── pullrequest.ts      # Operaciones de pull requests
│   └── branchingmodel.ts   # Operaciones de branching model
├── types/                  # Definiciones de tipos
│   └── index.ts            # Tipos principales del proyecto
├── utils/                  # Utilidades
│   └── logger.ts           # Configuración y utilidades de logging
├── index.ts                # Servidor MCP principal (modular)
└── index-original.ts       # Archivo original (respaldo)
```

## Beneficios de la Modularización

### 1. **Separación de Responsabilidades**

-   Cada servicio maneja un dominio específico (repositorios, pull requests, branching model)
-   Configuración y utilidades separadas del código de negocio
-   Esquemas de validación centralizados

### 2. **Mantenibilidad Mejorada**

-   Archivos más pequeños y enfocados (< 400 líneas cada uno)
-   Fácil localización de funcionalidades específicas
-   Cambios aislados por dominio

### 3. **Testabilidad**

-   Servicios independientes fáciles de mockear
-   Configuración inyectable para testing
-   Utilidades reutilizables

### 4. **Legibilidad**

-   Código más organizado y fácil de entender
-   Imports claros que muestran dependencias
-   Documentación específica por módulo

### 5. **Escalabilidad**

-   Fácil agregar nuevos servicios
-   Patrón establecido para futuras funcionalidades
-   Reutilización de componentes base

## Servicios Principales

### BaseService

-   Clase abstracta que proporciona cliente API configurado
-   Manejo de autenticación (token o username/password)
-   Interceptores de seguridad para logging y manejo de errores
-   Configuración HTTPS para producción

### RepositoryService

-   `listRepositories(workspace?, limit?)` - Lista repositorios
-   `getRepository(workspace, repo_slug)` - Obtiene detalles de repo

### PullRequestService

-   Operaciones CRUD de pull requests
-   Gestión de comentarios, diffs y commits
-   Acciones: aprobar, declinar, mergear

### BranchingModelService

-   Gestión de modelos de branching a nivel de repositorio
-   Gestión de modelos de branching a nivel de proyecto
-   Configuración de tipos de branches

## Configuración

La configuración se maneja a través de `src/config/bitbucket.ts`:

```typescript
export function createBitbucketConfig(): BitbucketConfig {
    return {
        baseUrl: process.env.BITBUCKET_URL ?? "https://api.bitbucket.org/2.0",
        token: process.env.BITBUCKET_TOKEN,
        username: process.env.BITBUCKET_USERNAME,
        password: process.env.BITBUCKET_PASSWORD,
        defaultWorkspace: process.env.BITBUCKET_WORKSPACE,
    };
}
```

## Logging Seguro

El sistema de logging en `src/utils/logger.ts` incluye:

-   Sanitización automática de credenciales
-   Rotación de archivos de log
-   Diferentes niveles según el entorno
-   Interceptores de API para debugging seguro

## Uso

El uso del servidor permanece igual:

```bash
npm run build
node dist/index.js
```

## Migración de Funcionalidades

Si necesitas agregar una nueva funcionalidad:

1. **Evalúa el dominio**: ¿Pertenece a un servicio existente?
2. **Crea el método** en el servicio correspondiente
3. **Agrega el esquema** en `src/schemas/tools.ts`
4. **Registra el handler** en `src/index.ts`
5. **Agrega tests** correspondientes

## Compatibilidad

La nueva arquitectura mantiene 100% de compatibilidad con:

-   APIs existentes de Bitbucket
-   Configuración de entorno
-   Scripts de testing (test-simple.cjs, test-mcp-client.js)
-   Integración con Cursor y otros clientes MCP

## Próximos Pasos

1. **Testing unitario** por servicio
2. **Documentación JSDoc** mejorada
3. **Métricas de performance** por servicio
4. **Cache** inteligente de respuestas API
5. **Rate limiting** configurable

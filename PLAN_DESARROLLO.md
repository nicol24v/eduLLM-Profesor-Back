# Plan de Desarrollo — Nuevas Funcionalidades
## eduLLM · Profesor MS

---

## 1. Contexto y alcance

### Qué se construye
| # | Funcionalidad | Tipo |
|---|---|---|
| 1 | Limpieza: eliminar integración RAG | Refactor |
| 2 | `POST /api/preguntas` — recibe cuestionario del ms-IA y persiste en BD | Nueva API |
| 3 | Motor de juego (migración de MindBuzz) — solo flujo de **profesor** | Nueva funcionalidad |
| 4 | SQLite como estado temporal durante el juego | Nueva infraestructura |
| 5 | Documentación Socket.io para equipo de frontend | Docs |

### Qué NO se construye aquí
- UI de ningún tipo
- Lógica del estudiante (player events llegan de MindBuzz y se reciben aquí, pero la UI es de MindBuzz)
- Integración RAG / IA (eliminada)

---

## 2. Principios de diseño

### Arquitectura en capas (Clean Architecture adaptada)

```
┌────────────────────────────────────────┐
│         PRESENTATION LAYER             │  HTTP routes + controllers
│   preguntas.routes.js                  │  Solo extrae params y delega
└──────────────────┬─────────────────────┘
                   │
┌──────────────────▼─────────────────────┐
│         APPLICATION LAYER              │  Use Cases (orquestadores)
│   CreateGameUseCase, ImportQuizUseCase │  Sin lógica de dominio propia
│   StartGameUseCase, EndGameUseCase...  │  Coordina domain + infra
└──────────────────┬─────────────────────┘
                   │
┌──────────────────▼─────────────────────┐
│           DOMAIN LAYER                 │  Entidades puras (sin frameworks)
│   GameRoom, GamePlayer, GameRegistry   │  Reglas de negocio del juego
│   QuizImporter, QuizValidator          │  Transformación del JSON
│   TimeBasedScoring                     │  Cálculo de puntos
└──────────────────┬─────────────────────┘
                   │
┌──────────────────▼─────────────────────┐
│       INFRASTRUCTURE LAYER             │  BD, Socket.io, Prisma
│   SQLiteGameRepository                 │  Estado del juego en curso
│   PrismaGameRepository                 │  Persistencia final (PostgreSQL)
│   SocketServer, ManagerSocketHandler   │  Eventos en tiempo real
│   PlayerSocketHandler                  │
└────────────────────────────────────────┘
```

### SOLID aplicado al proyecto

| Principio | Clase que lo aplica | Cómo |
|---|---|---|
| **S** — Single Responsibility | `GameRoom` | Solo gestiona estado del juego, nada más |
| **S** — Single Responsibility | `QuizImporter` | Solo transforma JSON MindBuzz → entidades |
| **S** — Single Responsibility | `QuizValidator` | Solo valida la estructura del JSON |
| **O** — Open/Closed | `TimeBasedScoring` | El sistema de scoring se puede cambiar sin tocar `GameRoom` (Strategy pattern) |
| **L** — Liskov Substitution | `SQLiteGameRepository` / `PrismaGameRepository` | Ambos cumplen el mismo contrato, intercambiables |
| **I** — Interface Segregation | `IGameReadRepository` / `IGameWriteRepository` | Separados: no todo quien lee necesita escribir |
| **D** — Dependency Inversion | `CreateGameUseCase` | Depende de interfaces de repositorio, no de Prisma directamente |

---

## 3. Diagrama de clases — Motor de juego

```
┌─────────────────────────────────────┐
│            GameRegistry             │  Singleton
├─────────────────────────────────────┤
│ - #games: Map<gameId, GameRoom>     │
├─────────────────────────────────────┤
│ + getInstance(): GameRegistry       │
│ + register(gameId, room): void      │
│ + get(gameId): GameRoom | null      │
│ + getByCode(code): GameRoom | null  │
│ + remove(gameId): void              │
└──────────────┬──────────────────────┘
               │ contiene
               ▼
┌─────────────────────────────────────┐
│              GameRoom               │  Entidad principal
├─────────────────────────────────────┤
│ - #id: string                       │
│ - #partida_id: number               │
│ - #quiz: QuizData                   │
│ - #status: GameStatus               │
│ - #players: Map<id, GamePlayer>     │
│ - #currentQuestion: number          │
│ - #questionStartTime: number        │
│ - #scoring: ScoringStrategy         │
│ - #cooldownTimer: NodeJS.Timer      │
│ - #io: Socket.IO                    │
├─────────────────────────────────────┤
│ + addPlayer(player): void           │
│ + kickPlayer(playerId): void        │
│ + start(): Promise<void>            │
│ + skipQuestion(): void              │
│ + showLeaderboard(): void           │
│ + nextRound(): Promise<void>        │
│ + submitAnswer(pid, idx, ts): void  │
│ + end(reason): void                 │
│ + getStatus(): GameStatusSnapshot   │
│ + getRanking(): PlayerRank[]        │
│ - #broadcastStatus(name, data)      │
│ - #startCooldown(secs)              │
└──────────────┬──────────────────────┘
               │ contiene N
               ▼
┌─────────────────────────────────────┐
│            GamePlayer               │  Value Object
├─────────────────────────────────────┤
│ - #id: string                       │
│ - #socketId: string                 │
│ - #username: string                 │
│ - #points: number                   │
│ - #correctAnswers: number           │
│ - #connected: boolean               │
├─────────────────────────────────────┤
│ + addPoints(n): void                │
│ + markCorrect(): void               │
│ + disconnect(): void                │
│ + reconnect(socketId): void         │
│ + toPublicDTO(): object             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│         TimeBasedScoring            │  Strategy
├─────────────────────────────────────┤
│ - #maxPoints: 1000                  │
├─────────────────────────────────────┤
│ + calculate(                        │
│     questionTimeSecs,               │
│     startTs, answerTs,              │
│     isCorrect                       │
│   ): number                         │
│                                     │
│  Formula:                           │
│  remaining = (questionTime×1000)    │
│            - (answerTs - startTs)   │
│  points = round(1000 ×             │
│           remaining/(time×1000))   │
│  Si no es correcta → 0              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│           QuizImporter              │
├─────────────────────────────────────┤
│ - #validator: QuizValidator         │
├─────────────────────────────────────┤
│ + import(json, origen, uid): PruebaDTO │
│ - #mapPrueba(json, origen, uid)     │
│ - #mapPregunta(q, pruebaId)         │
│ - #mapOpciones(answers, solutions)  │
│   → valida solutions.length === 1   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│           QuizValidator             │
├─────────────────────────────────────┤
│ + validate(json): void              │
│   lanza AppError si:                │
│   - subject vacío                   │
│   - questions.length < 1            │
│   - pregunta sin texto              │
│   - answers.length < 2              │
│   - solutions.length !== 1          │
│   - solutions[0] fuera de rango     │
└─────────────────────────────────────┘
```

---

## 4. Diagrama de clases — Infraestructura

```
┌─────────────────────────────────────┐
│        SQLiteGameRepository         │
├─────────────────────────────────────┤
│ - #db: BetterSqlite3.Database       │
├─────────────────────────────────────┤
│ + saveSession(gameId, opts): void   │
│ + addPlayer(gameId, player): void   │
│ + updatePlayer(gameId, pid, d): void│
│ + recordAnswer(gameId, data): void  │
│ + getSession(gameId): object        │
│ + getPlayers(gameId): object[]      │
│ + getAnswers(gameId): object[]      │
│ + deleteSession(gameId): void       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│        PrismaGameRepository         │
├─────────────────────────────────────┤
│ - #prisma: PrismaClient             │
├─────────────────────────────────────┤
│ + finalizeGame(gameId, sqliteRepo)  │
│   → escribe tbl_t_partida           │
│   → escribe tbl_t_partida_estudiante│
│   → escribe tbl_t_respuesta         │
│ + getQuizForGame(pruebaId)          │
│ + createPartida(pruebaId, code)     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│          SocketServer               │
├─────────────────────────────────────┤
│ - #io: Server                       │
│ - #managerHandler: ManagerHandler   │
│ - #playerHandler: PlayerHandler     │
├─────────────────────────────────────┤
│ + init(httpServer): void            │
│ + getIO(): Server                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       ManagerSocketHandler          │
├─────────────────────────────────────┤
│ - #useCases: { create, start... }   │
├─────────────────────────────────────┤
│ + registerEvents(socket, io): void  │
│ - #onGameCreate(socket, pruebaId)   │
│ - #onStartGame(socket, gameId)      │
│ - #onNextQuestion(socket, gameId)   │
│ - #onShowLeaderboard(socket, gid)   │
│ - #onEndGame(socket, gameId)        │
│ - #onAbortQuiz(socket, gameId)      │
│ - #onKickPlayer(socket, gid, pid)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       PlayerSocketHandler           │
├─────────────────────────────────────┤
│ - #useCases: { join, answer... }    │
├─────────────────────────────────────┤
│ + registerEvents(socket, io): void  │
│ - #onJoin(socket, inviteCode)       │
│ - #onLogin(socket, gameId, uname)   │
│ - #onAnswer(socket, gameId, idx)    │
│ - #onReconnect(socket, gameId)      │
└─────────────────────────────────────┘
```

---

## 5. Estados del juego y máquina de estados

```
                    ┌──────────────────┐
                    │    SHOW_ROOM     │ ← estado inicial
                    │  (esperando BD)  │
                    └────────┬─────────┘
                     manager:startGame
                             │
                    ┌────────▼─────────┐
                    │   SHOW_START     │ 3 seg (título + countdown)
                    └────────┬─────────┘
                         auto (3s)
                             │
                    ┌────────▼─────────┐
                    │  SHOW_PREPARED   │ 2 seg ("Pregunta #N" + íconos)
                    └────────┬─────────┘
                         auto (2s)
                             │
                    ┌────────▼─────────┐
                    │  SHOW_QUESTION   │ question.cooldown seg (imagen + texto)
                    └────────┬─────────┘
                         auto (cooldown)
                             │
                    ┌────────▼─────────┐
                    │  SELECT_ANSWER   │ question.time seg (respuestas)
                    │  ← respuestas    │   ← player:selectedAnswer
                    └────────┬─────────┘
                   auto (time) / manager:abortQuiz
                             │
                    ┌────────▼─────────┐
                    │  SHOW_RESPONSES  │ histograma al profesor
                    └────────┬─────────┘
               manager:showLeaderboard
                             │
                    ┌────────▼─────────┐
                    │ SHOW_LEADERBOARD │ top 5 al profesor
                    └────────┬─────────┘
                   manager:nextQuestion (si quedan)
                       o showLeaderboard → FINISHED (si es última)
                             │
                    ┌────────▼─────────┐
                    │    FINISHED      │ podio top 3
                    │  (finalizada BD) │
                    └────────┬─────────┘
                     manager:endGame
                             │
                        limpia sala
```

### Mapeo de estados ↔ `tbl_t_partida.estado_partida`

| Estado en memoria | `estado_partida` en BD |
|---|---|
| `SHOW_ROOM` | `esperando` |
| `SHOW_START` … `SHOW_LEADERBOARD` | `en_curso` |
| `FINISHED` | `finalizada` |

---

## 6. Fórmula de scoring

```
Datos:
  MAX_POINTS     = 1000 (constante por pregunta)
  questionTime   = question.time (segundos)
  startTimestamp = timestamp cuando empezó SELECT_ANSWER
  answerTimestamp = timestamp cuando llegó la respuesta

Cálculo:
  elapsed_ms   = answerTimestamp - startTimestamp
  remaining_ms = max(0, questionTime × 1000 - elapsed_ms)
  points       = round(MAX_POINTS × (remaining_ms / (questionTime × 1000)))

Regla: Si la respuesta es incorrecta → points = 0

Ejemplo:
  questionTime = 20s, respondió en 5s
  remaining_ms = 20000 - 5000 = 15000
  points = round(1000 × (15000 / 20000)) = round(750) = 750
```

---

## 7. Flujo SQLite → PostgreSQL al finalizar

```
Durante el juego (SQLite - game.db):

  game_sessions
  ├── game_id TEXT PK
  ├── partida_id INTEGER
  ├── prueba_id INTEGER
  ├── invite_code TEXT
  ├── status TEXT
  └── started_at TEXT

  game_players
  ├── game_id TEXT
  ├── player_id TEXT PK
  ├── socket_id TEXT
  ├── username TEXT
  ├── points INTEGER
  ├── correct_answers INTEGER
  └── estudiante_materia_id INTEGER (nullable)

  game_answers
  ├── game_id TEXT
  ├── player_id TEXT
  ├── question_index INTEGER
  ├── option_index INTEGER
  ├── is_correct BOOLEAN
  ├── points_obtained INTEGER
  └── time_ms INTEGER

Al finalizar → migración a PostgreSQL:
  game_sessions   → UPDATE tbl_t_partida (estado, finalizado_en)
  game_players    → INSERT tbl_t_partida_estudiante (puntaje_total, respuestas_correctas)
  game_answers    → INSERT tbl_t_respuesta (opcion, tiempo_ms, puntaje_obtenido)
  Luego          → DELETE FROM game_* WHERE game_id = ?
```

---

## 8. Archivos nuevos a crear

### Domain Layer (`src/domain/`)
| Archivo | Clase | Responsabilidad |
|---|---|---|
| `domain/game/GameStatus.js` | `GameStatus` (enum) | Constantes STATUS y datos por estado |
| `domain/game/GamePlayer.js` | `GamePlayer` | Entidad jugador (puntos, estado conexión) |
| `domain/game/GameRoom.js` | `GameRoom` | Máquina de estados del juego |
| `domain/game/GameRegistry.js` | `GameRegistry` | Singleton: registry de partidas activas |
| `domain/quiz/QuizValidator.js` | `QuizValidator` | Valida JSON MindBuzz |
| `domain/quiz/QuizImporter.js` | `QuizImporter` | Transforma JSON → entidades BD |
| `domain/scoring/TimeBasedScoring.js` | `TimeBasedScoring` | Cálculo de puntos |

### Application Layer (`src/application/`)
| Archivo | Clase | Responsabilidad |
|---|---|---|
| `application/usecases/CreateGameUseCase.js` | `CreateGameUseCase` | Crea GameRoom + fila en tbl_t_partida |
| `application/usecases/StartGameUseCase.js` | `StartGameUseCase` | Inicia flujo de juego |
| `application/usecases/NextQuestionUseCase.js` | `NextQuestionUseCase` | Avanza pregunta |
| `application/usecases/ShowLeaderboardUseCase.js` | `ShowLeaderboardUseCase` | Muestra ranking intermedio |
| `application/usecases/EndGameUseCase.js` | `EndGameUseCase` | Finaliza y persiste en PostgreSQL |
| `application/usecases/KickPlayerUseCase.js` | `KickPlayerUseCase` | Expulsa jugador |
| `application/usecases/JoinGameUseCase.js` | `JoinGameUseCase` | Estudiante entra con código |
| `application/usecases/SubmitAnswerUseCase.js` | `SubmitAnswerUseCase` | Recibe y evalúa respuesta |
| `application/usecases/ImportQuizUseCase.js` | `ImportQuizUseCase` | Persiste quiz importado |

### Infrastructure Layer (`src/infrastructure/`)
| Archivo | Clase | Responsabilidad |
|---|---|---|
| `infrastructure/persistence/SQLiteClient.js` | `SQLiteClient` | Singleton conexión SQLite |
| `infrastructure/persistence/SQLiteGameRepository.js` | `SQLiteGameRepository` | CRUD estado de juego en SQLite |
| `infrastructure/persistence/PrismaGameRepository.js` | `PrismaGameRepository` | Persistencia final en PostgreSQL |
| `infrastructure/socket/SocketServer.js` | `SocketServer` | Inicializa Socket.io, registra handlers |
| `infrastructure/socket/handlers/ManagerSocketHandler.js` | `ManagerSocketHandler` | Eventos del profesor |
| `infrastructure/socket/handlers/PlayerSocketHandler.js` | `PlayerSocketHandler` | Eventos del estudiante |

### Presentation Layer (`src/presentation/`)
| Archivo | Clase/Módulo | Responsabilidad |
|---|---|---|
| `presentation/routes/v1/preguntas.routes.js` | — | Ruta `POST /api/preguntas` |
| `presentation/controllers/PreguntasController.js` | `PreguntasController` | Extrae body, delega a use case |

### Docs
| Archivo | Contenido |
|---|---|
| `docs/SOCKET.md` | Referencia completa de eventos + ejemplos React/TS |

---

## 9. Fases de implementación

```
Fase 1 — Limpieza (sin nuevos archivos)
  └─ Eliminar createWithAI, RAG_SERVICE_URL, rutas REST de control de partida

Fase 2 — Domain Layer
  └─ GameStatus → GamePlayer → TimeBasedScoring → GameRoom → GameRegistry
  └─ QuizValidator → QuizImporter

Fase 3 — Infrastructure Layer
  └─ SQLiteClient → SQLiteGameRepository
  └─ PrismaGameRepository

Fase 4 — Application Layer
  └─ ImportQuizUseCase
  └─ CreateGame → StartGame → NextQuestion → ShowLeaderboard
  └─ EndGame → KickPlayer → JoinGame → SubmitAnswer

Fase 5 — Infrastructure Socket
  └─ ManagerSocketHandler → PlayerSocketHandler → SocketServer

Fase 6 — Presentation
  └─ PreguntasController → preguntas.routes.js
  └─ Actualizar app.js para usar nuevo SocketServer
  └─ Actualizar server.js

Fase 7 — Docs
  └─ docs/SOCKET.md
  └─ Actualizar docs/API.md, docs/SERVICES.md
```

---

## 10. Cambios a archivos existentes

| Archivo existente | Cambio |
|---|---|
| `src/services/cuestionario.service.js` | Eliminar `createWithAI` y `createWithIA` |
| `src/routes/v1/cuestionario.routes.js` | Eliminar `POST /ia` |
| `src/controllers/cuestionario.controller.js` | Eliminar `createWithAI` |
| `src/routes/v1/partida.routes.js` | Eliminar `PUT /iniciar`, `/siguiente-pregunta`, `/finalizar` |
| `src/controllers/partida.controller.js` | Eliminar `iniciar`, `siguientePregunta`, `finalizar` |
| `src/services/partida.service.js` | Eliminar `iniciar`, `siguientePregunta`, `finalizar` |
| `src/socket/socket.js` | Reemplazar por nuevo `SocketServer` |
| `src/app.js` | Registrar nueva ruta `/api/preguntas` |
| `server.js` | Usar nuevo `SocketServer.init(httpServer)` |
| `.env` / `.env.example` / `docker-compose.yml` | Eliminar `RAG_SERVICE_URL`, añadir `SQLITE_PATH` |
| `package.json` | Añadir `better-sqlite3` |

---

*Documento generado: 2026-06-12*

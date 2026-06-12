# Socket.io — Referencia completa para el front-end

Este documento describe todos los eventos Socket.io del microservicio de profesores (puerto `8085`).
Los estudiantes también se conectan a este servidor (conexión desde MindBuzz o el futuro front de estudiante).

---

## Conexión

```ts
import { io, Socket } from 'socket.io-client';

// Profesor/Manager
const managerSocket: Socket = io('http://localhost:8085', {
  query: { role: 'manager' },
  transports: ['websocket'],
});

// Jugador/Estudiante
const playerSocket: Socket = io('http://localhost:8085', {
  query: { role: 'player' },
  transports: ['websocket'],
});
```

El parámetro `role` en el query determina qué handler recibe los eventos del socket.

---

## Flujo de estados del juego

```
SHOW_ROOM → SHOW_START → SHOW_PREPARED → SHOW_QUESTION → SELECT_ANSWER → SHOW_RESPONSES → SHOW_LEADERBOARD → FINISHED
                                             ↑_______________________________________________↑
                                             (se repite por cada pregunta)
```

| Estado           | Descripción                                        |
|------------------|----------------------------------------------------|
| `SHOW_ROOM`      | Sala de espera, jugadores pueden unirse            |
| `SHOW_START`     | El profesor inicia — se muestra pantalla de inicio |
| `SHOW_PREPARED`  | Transición — preparando siguiente pregunta         |
| `SHOW_QUESTION`  | Se muestra la pregunta (cooldown activo)           |
| `SELECT_ANSWER`  | Jugadores pueden enviar respuestas                 |
| `SHOW_RESPONSES` | Se muestran las respuestas con conteos             |
| `SHOW_LEADERBOARD` | Tabla de posiciones actual                       |
| `FINISHED`       | Partida finalizada, resultados persisted           |

---

## Eventos del Manager (Profesor)

### `manager:create_game` → Crear sala

```ts
managerSocket.emit('manager:create_game', {
  pruebaId: 5,
  usuarioId: 12,
}, (res: AckResponse<CreateGameResult>) => {
  if (res.ok) console.log(res.data.codigoAcceso); // e.g. "ABC123"
});

interface CreateGameResult {
  partidaId: number;
  codigoAcceso: string;
  titulo: string;
  totalPreguntas: number;
}
```

### `manager:start` → Iniciar partida (cierra sala de espera)

```ts
managerSocket.emit('manager:start', {
  codigoAcceso: 'ABC123',
  usuarioId: 12,
}, (res: AckResponse<void>) => {});
```

### `manager:next_question` → Avanzar a la siguiente pregunta

```ts
managerSocket.emit('manager:next_question', {
  codigoAcceso: 'ABC123',
}, (res: AckResponse<QuestionManagerView>) => {
  // res.data contiene la pregunta con es_correcta visible
});
```

### `manager:open_answers` → Abrir período de respuestas (manual, si el cooldown automático no es suficiente)

```ts
managerSocket.emit('manager:open_answers', { codigoAcceso: 'ABC123' }, (res) => {});
```

### `manager:show_leaderboard` → Cerrar respuestas y mostrar tabla

```ts
managerSocket.emit('manager:show_leaderboard', {
  codigoAcceso: 'ABC123',
}, (res: AckResponse<LeaderboardResult>) => {
  console.log(res.data.leaderboard);
  console.log(res.data.results); // conteo de respuestas por opción
});
```

### `manager:end_game` → Finalizar partida y persistir resultados

```ts
managerSocket.emit('manager:end_game', {
  codigoAcceso: 'ABC123',
}, (res: AckResponse<{ leaderboard: LeaderboardEntry[] }>) => {});
```

### `manager:kick_player` → Expulsar jugador (solo en SHOW_ROOM)

```ts
managerSocket.emit('manager:kick_player', {
  codigoAcceso: 'ABC123',
  playerId: 'player-uuid-or-id',
}, (res) => {});
```

### `manager:rejoin` → Reconectar al manager tras pérdida de conexión

```ts
managerSocket.emit('manager:rejoin', {
  codigoAcceso: 'ABC123',
}, (res: AckResponse<RoomState>) => {});
```

---

## Eventos del Jugador

### `player:join` → Unirse a una sala

```ts
playerSocket.emit('player:join', {
  codigoAcceso: 'ABC123',
  playerId: '42',          // estudiante_materia_id o UUID para anónimos
  nickname: 'AlumnoX',
}, (res: AckResponse<JoinResult>) => {
  console.log(res.data.status);       // estado actual de la sala
  console.log(res.data.playerCount);
  console.log(res.data.titulo);
});
```

### `player:answer` → Enviar respuesta

```ts
playerSocket.emit('player:answer', {
  codigoAcceso: 'ABC123',
  playerId: '42',
  opcionId: 7,             // id_opcion de la opción elegida
}, (res: AckResponse<AnswerResult>) => {
  console.log(res.data.accepted);    // false si ya respondió o está cerrado
  console.log(res.data.isCorrect);
  console.log(res.data.points);
});
```

### `player:leave` → Salir voluntariamente (solo en SHOW_ROOM)

```ts
playerSocket.emit('player:leave');
```

---

## Eventos que el servidor emite a la sala (escuchar en ambos lados)

### `game:player_joined`
```ts
socket.on('game:player_joined', (data: {
  playerId: string;
  nickname: string;
  playerCount: number;
  reconnected: boolean;
}) => {});
```

### `game:player_left`
```ts
socket.on('game:player_left', (data: {
  playerId: string;
  playerCount: number;
}) => {});
```

### `game:started`
```ts
socket.on('game:started', (data: {
  status: 'SHOW_START';
  titulo: string;
  totalPreguntas: number;
}) => {});
```

### `game:question` (jugadores — sin `es_correcta`)
```ts
socket.on('game:question', (data: QuestionPlayerView) => {});

interface QuestionPlayerView {
  index: number;
  total: number;
  texto: string;
  tipo: 'single_choice';
  tiempo_limite: number;   // segundos
  cooldown: number;        // segundos antes de abrir respuestas
  image_url: string | null;
  opciones: { id_opcion: number; texto: string; orden: number }[];
}
```

### `game:question_manager` (solo el profesor — incluye `es_correcta`)
```ts
managerSocket.on('game:question_manager', (data: QuestionManagerView) => {});

interface QuestionManagerView extends QuestionPlayerView {
  opciones: { id_opcion: number; texto: string; orden: number; es_correcta: boolean }[];
}
```

### `game:open_answers`
```ts
socket.on('game:open_answers', (data: { questionIndex: number }) => {
  // Mostrar botones de respuesta a los jugadores
});
```

### `game:responses` — Conteo de respuestas por opción
```ts
socket.on('game:responses', (data: {
  results: {
    id_opcion: number;
    texto: string;
    es_correcta: boolean;
    respuestas: number;
  }[];
}) => {});
```

### `game:leaderboard` — Tabla de posiciones
```ts
socket.on('game:leaderboard', (data: {
  leaderboard: LeaderboardEntry[];
}) => {});

interface LeaderboardEntry {
  position: number;
  playerId: string;
  nickname: string;
  score: number;
  correctAnswers: number;
}
```

### `game:finished`
```ts
socket.on('game:finished', (data: {
  leaderboard: LeaderboardEntry[];
}) => {
  // Mostrar pantalla de resultados finales
});
```

### `game:kicked`
```ts
playerSocket.on('game:kicked', () => {
  // Redirigir al jugador fuera del juego
});
```

---

## Tipos TypeScript reutilizables

```ts
interface AckResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface RoomState {
  partidaId: number;
  codigoAcceso: string;
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  playerCount: number;
}

type GameStatus =
  | 'SHOW_ROOM'
  | 'SHOW_START'
  | 'SHOW_PREPARED'
  | 'SHOW_QUESTION'
  | 'SELECT_ANSWER'
  | 'SHOW_RESPONSES'
  | 'SHOW_LEADERBOARD'
  | 'FINISHED';
```

---

## Cálculo de puntaje

Idéntico al algoritmo de MindBuzz:

```
points = round(1000 × remainingMs / (questionTime × 1000))
```

- `remainingMs = max(0, questionTime × 1000 − elapsedMs)`
- `elapsedMs` = tiempo transcurrido desde que se abrieron las respuestas hasta que el jugador respondió
- Respuesta incorrecta = **0 puntos** siempre
- Máximo posible: **1000 puntos** (responder en el instante que se abren las respuestas)

**Ejemplo:**
- `questionTime = 15s`, jugador responde a los `6s` → `remainingMs = 9000`
- `points = round(1000 × 9000 / 15000) = round(600) = 600`

---

## Ejemplo completo — React + TypeScript (Manager)

```tsx
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

function useManagerSocket(codigoAcceso: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:8085', {
      query: { role: 'manager' },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('manager:rejoin', { codigoAcceso }, (res) => {
        if (!res.ok) console.error(res.error);
      });
    });

    socket.on('game:player_joined', ({ nickname, playerCount }) => {
      console.log(`${nickname} se unió. Total: ${playerCount}`);
    });

    socket.on('game:question_manager', (question) => {
      console.log('Pregunta para el profesor:', question);
    });

    socket.on('game:leaderboard', ({ leaderboard }) => {
      console.log('Tabla de posiciones:', leaderboard);
    });

    socket.on('game:finished', ({ leaderboard }) => {
      console.log('Partida finalizada:', leaderboard);
    });

    return () => { socket.disconnect(); };
  }, [codigoAcceso]);

  const startGame = (usuarioId: number) => {
    socketRef.current?.emit('manager:start', { codigoAcceso, usuarioId }, (res) => {
      if (!res.ok) alert(res.error);
    });
  };

  const nextQuestion = () => {
    socketRef.current?.emit('manager:next_question', { codigoAcceso }, (res) => {
      if (!res.ok) alert(res.error);
    });
  };

  const showLeaderboard = () => {
    socketRef.current?.emit('manager:show_leaderboard', { codigoAcceso });
  };

  const endGame = () => {
    socketRef.current?.emit('manager:end_game', { codigoAcceso });
  };

  return { startGame, nextQuestion, showLeaderboard, endGame };
}
```

---

## Ejemplo completo — React + TypeScript (Player)

```tsx
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

function usePlayerSocket(codigoAcceso: string, playerId: string, nickname: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:8085', {
      query: { role: 'player' },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('player:join', { codigoAcceso, playerId, nickname }, (res) => {
        if (!res.ok) console.error(res.error);
      });
    });

    socket.on('game:started', ({ titulo, totalPreguntas }) => {
      console.log(`El juego "${titulo}" (${totalPreguntas} preguntas) ha comenzado`);
    });

    socket.on('game:question', (question) => {
      console.log('Nueva pregunta:', question.texto);
    });

    socket.on('game:open_answers', () => {
      console.log('¡Ya puedes responder!');
    });

    socket.on('game:leaderboard', ({ leaderboard }) => {
      console.log('Tu posición:', leaderboard.find(e => e.playerId === playerId));
    });

    socket.on('game:kicked', () => {
      console.log('Fuiste expulsado del juego');
    });

    return () => { socket.disconnect(); };
  }, [codigoAcceso, playerId, nickname]);

  const sendAnswer = (opcionId: number) => {
    socketRef.current?.emit('player:answer', { codigoAcceso, playerId, opcionId }, (res) => {
      if (res.ok) {
        console.log(`Respuesta ${res.data.isCorrect ? 'correcta' : 'incorrecta'} — ${res.data.points} pts`);
      }
    });
  };

  return { sendAnswer };
}
```

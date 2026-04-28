import { createFileRoute } from "@tanstack/react-router";
import type { LDClient } from "launchdarkly-js-client-sdk";
import { Activity, Crosshair, Flame, RadioTower, RotateCcw, Satellite, Shield, Waves, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

type GameState = "INIT" | "INSTRUCTION" | "RUNNING" | "GAME_OVER";
type Weapon = "fire" | "water" | "laser beam";
type WeaponFlag =
  | Weapon
  | "fire and water"
  | "fire and laser beam"
  | "water and laser beam"
  | "fire, water and laser beam"
  | "stealth mode";
type MonsterKind = "leaf" | "fire" | "stone" | "goblin";

type Monster = {
  id: string;
  kind: MonsterKind;
  x: number;
  y: number;
  speed: number;
};

const FLAG_KEY = "weapon_type_flag";
const CLIENT_ID_KEY = "ld-mothership-client-side-id";
const SHIP_LINE = 86;
const SPAWN_INTERVAL_MS = 2_000;
const LEVEL_DURATION_MS = 15_000;
const STEALTH_LIMIT_MS = 10_000;

const monsterSpecs: Record<MonsterKind, { name: string; weakness: Weapon | "stealth"; icon: string }> = {
  leaf: { name: "Leaf Space Monster", weakness: "fire", icon: "☘" },
  fire: { name: "Fire Space Monster", weakness: "water", icon: "🔥" },
  stone: { name: "Stone Space Monster", weakness: "laser beam", icon: "◆" },
  goblin: { name: "Goblin Thief Monster", weakness: "stealth", icon: "👾" },
};

const weaponOptions: WeaponFlag[] = [
  "fire",
  "water",
  "laser beam",
  "fire and water",
  "fire and laser beam",
  "water and laser beam",
  "fire, water and laser beam",
  "stealth mode",
];

const weaponVisuals: Record<Weapon, { icon: typeof Flame; label: string }> = {
  fire: { icon: Flame, label: "Fire" },
  water: { icon: Waves, label: "Water" },
  "laser beam": { icon: Zap, label: "Laser" },
};

function weaponsFromFlag(flag: string): Weapon[] {
  if (flag === "stealth mode") return [];
  return (["fire", "water", "laser beam"] as Weapon[]).filter((weapon) => flag.includes(weapon));
}

function getLevel(elapsedMs: number) {
  return Math.min(3, Math.floor(elapsedMs / LEVEL_DURATION_MS) + 1);
}

function spawnForLevel(level: number): Monster[] {
  const standardKinds: MonsterKind[] = ["leaf", "fire", "stone"];
  if (level === 3 && Math.random() < 0.28) {
    return [makeMonster("goblin")];
  }

  const count = level === 1 ? 1 : level === 2 ? 2 : Math.floor(Math.random() * 3) + 1;
  return shuffle(standardKinds)
    .slice(0, count)
    .map((kind) => makeMonster(kind));
}

function makeMonster(kind: MonsterKind): Monster {
  const baseSpeed = kind === "goblin" ? 14 : 5 + Math.random() * 4;
  return {
    id: `${kind}-${crypto.randomUUID()}`,
    kind,
    x: 12 + Math.random() * 76,
    y: -8 - Math.random() * 8,
    speed: baseSpeed,
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function Index() {
  const [clientSideId, setClientSideId] = useState("");
  const [draftClientId, setDraftClientId] = useState("");
  const [ldStatus, setLdStatus] = useState<"idle" | "connecting" | "ready" | "error">("idle");
  const [flagValue, setFlagValue] = useState<WeaponFlag>("stealth mode");
  const [gameState, setGameState] = useState<GameState>("INIT");
  const [score, setScore] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stealthMs, setStealthMs] = useState(STEALTH_LIMIT_MS);
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [gameOverReason, setGameOverReason] = useState("");
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const clientRef = useRef<LDClient | null>(null);
  const lastSpawnRef = useRef(0);

  const activeWeapons = useMemo(() => weaponsFromFlag(flagValue), [flagValue]);
  const isStealth = activeWeapons.length === 0 || flagValue === "stealth mode";
  const level = getLevel(elapsedMs);

  useEffect(() => {
    const cached = window.localStorage.getItem(CLIENT_ID_KEY) ?? "";
    if (cached) {
      setClientSideId(cached);
      setDraftClientId(cached);
    }
  }, []);

  useEffect(() => {
    if (!clientSideId) return;

    let cancelled = false;
    setLdStatus("connecting");

    async function connectLaunchDarkly() {
      try {
        const LDClientModule = await import("launchdarkly-js-client-sdk");
        clientRef.current?.close();
        const client = LDClientModule.initialize(clientSideId, {
          kind: "user",
          key: "mothership-defense-pilot",
          name: "Mothership Pilot",
        });
        clientRef.current = client;
        await client.waitForInitialization({ timeout: 8 });
        if (cancelled) return;
        const nextValue = normalizeFlag(client.variation(FLAG_KEY, "stealth mode"));
        setFlagValue(nextValue);
        setLdStatus("ready");
        setGameState((state) => (state === "INIT" ? "INSTRUCTION" : state));
        client.on(`change:${FLAG_KEY}`, (value) => setFlagValue(normalizeFlag(value)));
      } catch {
        if (!cancelled) setLdStatus("error");
      }
    }

    connectLaunchDarkly();

    return () => {
      cancelled = true;
    };
  }, [clientSideId]);

  useEffect(() => {
    if (gameState !== "RUNNING") return;

    const tick = window.setInterval(() => {
      setScore((current) => current + 100);
      setElapsedMs((current) => current + 100);
      setStealthMs((current) => {
        if (!isStealth) return current;
        const next = Math.max(0, current - 100);
        if (next === 0) endGame("Stealth reserves depleted before the mothership escaped.");
        return next;
      });

      setMonsters((current) => {
        const currentLevel = getLevel(elapsedMs);
        let nextMonsters = current.map((monster) => ({ ...monster, y: monster.y + monster.speed * 0.1 }));

        nextMonsters = nextMonsters.filter((monster) => {
          if (monster.kind === "goblin") return true;
          return !activeWeapons.includes(monsterSpecs[monster.kind].weakness as Weapon);
        });

        for (const monster of nextMonsters) {
          if (monster.y >= SHIP_LINE) {
            if (monster.kind === "goblin") {
              if (isStealth) continue;
              endGame("A Goblin Thief reached the ship while weapons were visible.");
            } else {
              endGame(`${monsterSpecs[monster.kind].name} crossed the firing line.`);
            }
          }
        }

        nextMonsters = nextMonsters.filter((monster) => monster.y < 104);

        if (Date.now() - lastSpawnRef.current >= SPAWN_INTERVAL_MS) {
          lastSpawnRef.current = Date.now();
          const hasGoblin = nextMonsters.some((monster) => monster.kind === "goblin");
          if (!hasGoblin) nextMonsters = [...nextMonsters, ...spawnForLevel(currentLevel)];
        }

        return nextMonsters;
      });
    }, 100);

    return () => window.clearInterval(tick);
  }, [activeWeapons, elapsedMs, gameState, isStealth]);

  function normalizeFlag(value: unknown): WeaponFlag {
    return weaponOptions.includes(value as WeaponFlag) ? (value as WeaponFlag) : "stealth mode";
  }

  function saveClientId() {
    const clean = draftClientId.trim();
    if (!clean) return;
    window.localStorage.setItem(CLIENT_ID_KEY, clean);
    setClientSideId(clean);
  }

  function startGame() {
    setScore(0);
    setElapsedMs(0);
    setStealthMs(STEALTH_LIMIT_MS);
    setMonsters([]);
    setGameOverReason("");
    lastSpawnRef.current = 0;
    setGameState("RUNNING");
  }

  function endGame(reason: string) {
    setGameOverReason(reason);
    setGameState("GAME_OVER");
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-gradient-space text-space-foreground"
      onPointerMove={(event) => {
        const target = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - target.left) / target.width) * 100,
          y: ((event.clientY - target.top) / target.height) * 100,
        });
      }}
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-40 transition-transform duration-300"
        style={{
          background: `radial-gradient(circle at ${pointer.x}% ${pointer.y}%, var(--color-primary), transparent 22%)`,
        }}
      />
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="grid gap-3 rounded-lg border bg-panel/80 p-4 text-panel-foreground shadow-command backdrop-blur md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              <Satellite className="size-4" /> LaunchDarkly Mothership Defense v1.0
            </p>
            <h1 className="font-display mt-1 text-3xl font-bold leading-tight sm:text-5xl">
              Defend the flag-powered mothership
            </h1>
          </div>
          <div className="grid gap-2 sm:min-w-80">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-1 font-semibold",
                  ldStatus === "ready" ? "border-success bg-success/15 text-success" : "border-hazard bg-hazard/15 text-hazard",
                )}
              >
                <span className="size-2 rounded-full bg-current" />
                {ldStatus === "ready" ? "LaunchDarkly connected" : ldStatus === "connecting" ? "Connecting" : "LaunchDarkly not ready"}
              </span>
              <span className="rounded-md border bg-muted/20 px-3 py-1 font-mono text-xs">{FLAG_KEY}</span>
            </div>
            <div className="flex gap-2">
              <input
                value={draftClientId}
                onChange={(event) => setDraftClientId(event.target.value)}
                placeholder="Client-side ID"
                className="min-w-0 flex-1 rounded-md border bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
              />
              <Button variant="command" onClick={saveClientId} type="button">
                Init
              </Button>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[18rem_1fr_19rem]">
          <StatusPanel score={score} level={level} flagValue={flagValue} stealthMs={stealthMs} activeWeapons={activeWeapons} />
          <Battlefield monsters={monsters} activeWeapons={activeWeapons} isStealth={isStealth} level={level} gameState={gameState} />
          <CommandPanel gameState={gameState} ldReady={ldStatus === "ready"} startGame={startGame} />
        </div>
      </section>

      {gameState === "INIT" && <InitOverlay saveClientId={saveClientId} draftClientId={draftClientId} setDraftClientId={setDraftClientId} />}
      {gameState === "GAME_OVER" && (
        <GameOverOverlay score={score} reason={gameOverReason} onRestart={() => setGameState("INSTRUCTION")} />
      )}
    </main>
  );
}

function StatusPanel({
  score,
  level,
  flagValue,
  stealthMs,
  activeWeapons,
}: {
  score: number;
  level: number;
  flagValue: WeaponFlag;
  stealthMs: number;
  activeWeapons: Weapon[];
}) {
  return (
    <aside className="rounded-lg border bg-gradient-panel p-4 text-panel-foreground shadow-command backdrop-blur">
      <div className="grid gap-3">
        <Metric label="Score" value={score.toLocaleString()} />
        <Metric label="Level" value={`${level} / 3`} />
        <Metric label="Stealth" value={`${(stealthMs / 1000).toFixed(1)}s`} danger={stealthMs <= 3_000} />
        <div className="rounded-lg border bg-background/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Weapon flag</p>
          <p className="mt-1 font-display text-xl font-bold text-primary">{flagValue}</p>
          <div className="mt-3 grid gap-2">
            {activeWeapons.length ? (
              activeWeapons.map((weapon) => {
                const Icon = weaponVisuals[weapon].icon;
                return (
                  <span key={weapon} className="inline-flex items-center gap-2 rounded-md border bg-card/15 px-3 py-2 text-sm font-semibold">
                    <Icon className="size-4 text-accent" /> {weaponVisuals[weapon].label} armed
                  </span>
                );
              })
            ) : (
              <span className="inline-flex items-center gap-2 rounded-md border border-stealth bg-stealth/15 px-3 py-2 text-sm font-semibold text-stealth">
                <Shield className="size-4" /> Stealth field active
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-background/10 p-3", danger && "animate-alert-pulse border-hazard text-hazard")}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Battlefield({
  monsters,
  activeWeapons,
  isStealth,
  level,
  gameState,
}: {
  monsters: Monster[];
  activeWeapons: Weapon[];
  isStealth: boolean;
  level: number;
  gameState: GameState;
}) {
  return (
    <section className="scanline relative min-h-[560px] overflow-hidden rounded-lg border bg-space shadow-command game-grid">
      <div className="absolute left-4 top-4 z-10 rounded-md border bg-panel/75 px-3 py-2 text-sm font-semibold text-panel-foreground backdrop-blur">
        Active monsters: {monsters.length}
      </div>
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        {(["fire", "water", "laser beam"] as Weapon[]).map((weapon) => {
          const Icon = weaponVisuals[weapon].icon;
          return (
            <span
              key={weapon}
              className={cn(
                "grid size-10 place-items-center rounded-md border bg-panel/70 text-muted-foreground backdrop-blur transition",
                activeWeapons.includes(weapon) && "border-primary text-primary shadow-glow",
              )}
              title={weapon}
            >
              <Icon className="size-5" />
            </span>
          );
        })}
      </div>
      <div className="absolute inset-x-0 top-[86%] border-t border-dashed border-hazard/70" />
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <div className={cn("relative grid size-28 place-items-center transition", isStealth && "opacity-70")}> 
          <div className={cn("absolute inset-0 rounded-full border border-primary/35", isStealth ? "bg-stealth/20 shadow-glow" : "bg-primary/15")} />
          <div className="font-display relative text-6xl">🚀</div>
          <p className="absolute -bottom-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">Mothership</p>
        </div>
      </div>
      {monsters.map((monster) => (
        <MonsterSprite key={monster.id} monster={monster} />
      ))}
      {gameState !== "RUNNING" && (
        <div className="absolute inset-0 grid place-items-center bg-space/55 p-6 text-center backdrop-blur-sm">
          <div>
            <p className="font-display text-4xl font-bold">Level {level} defense grid</p>
            <p className="mt-2 max-w-xl text-muted-foreground">Launch the run, then change {FLAG_KEY} in LaunchDarkly to match incoming weaknesses.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function MonsterSprite({ monster }: { monster: Monster }) {
  const spec = monsterSpecs[monster.kind];
  return (
    <div
      className={cn(
        "absolute grid size-16 place-items-center rounded-lg border bg-panel/85 text-3xl shadow-command transition-transform duration-100",
        monster.kind === "goblin" && "animate-alert-pulse border-hazard bg-hazard/20",
      )}
      style={{ left: `${monster.x}%`, top: `${monster.y}%`, transform: "translate(-50%, -50%)" }}
      title={`${spec.name} — weakness: ${spec.weakness}`}
    >
      <span>{spec.icon}</span>
      <span className="absolute -bottom-6 rounded-sm bg-panel px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-panel-foreground">
        {spec.weakness}
      </span>
    </div>
  );
}

function CommandPanel({ gameState, ldReady, startGame }: { gameState: GameState; ldReady: boolean; startGame: () => void }) {
  return (
    <aside className="rounded-lg border bg-gradient-panel p-4 text-panel-foreground shadow-command backdrop-blur">
      <div className="flex h-full flex-col gap-4">
        <div className="rounded-lg border bg-background/10 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <RadioTower className="size-4" /> Mission rules
          </p>
          <ul className="mt-3 grid gap-3 text-sm text-muted-foreground">
            <li>Leaf falls to fire. Fire falls to water. Stone falls to laser beam.</li>
            <li>Level 2 can spawn two monster types at once.</li>
            <li>Level 3 adds Goblins. Use stealth mode before they touch the ship.</li>
            <li>Stealth is limited to ten total seconds per run.</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-background/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Supported variations</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {weaponOptions.map((option) => (
              <span key={option} className="rounded-md border bg-card/10 px-2 py-1 text-xs font-semibold text-panel-foreground">
                {option}
              </span>
            ))}
          </div>
        </div>
        <Button variant={gameState === "RUNNING" ? "secondary" : "command"} size="xl" disabled={!ldReady || gameState === "RUNNING"} onClick={startGame}>
          <Crosshair className="size-5" /> {gameState === "RUNNING" ? "Defense active" : "Start defense"}
        </Button>
      </div>
    </aside>
  );
}

function InitOverlay({
  saveClientId,
  draftClientId,
  setDraftClientId,
}: {
  saveClientId: () => void;
  draftClientId: string;
  setDraftClientId: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-space/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-lg border bg-gradient-panel p-6 text-panel-foreground shadow-command">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          <Activity className="size-4" /> INIT
        </p>
        <h2 className="font-display mt-2 text-3xl font-bold">Connect LaunchDarkly</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enter your client-side ID once. It is stored in this browser and reused for future runs.</p>
        <div className="mt-5 flex gap-2">
          <input
            value={draftClientId}
            onChange={(event) => setDraftClientId(event.target.value)}
            placeholder="LaunchDarkly client-side ID"
            className="min-w-0 flex-1 rounded-md border bg-background/80 px-3 py-2 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-ring"
          />
          <Button variant="command" onClick={saveClientId}>Submit</Button>
        </div>
      </div>
    </div>
  );
}

function GameOverOverlay({ score, reason, onRestart }: { score: number; reason: string; onRestart: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-space/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-lg border border-hazard bg-gradient-panel p-6 text-center text-panel-foreground shadow-command">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-hazard">Game over</p>
        <h2 className="font-display mt-2 text-5xl font-bold">{score.toLocaleString()}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{reason || "The mothership defense grid collapsed."}</p>
        <Button className="mt-6" variant="danger" size="xl" onClick={onRestart}>
          <RotateCcw className="size-5" /> Restart
        </Button>
      </div>
    </div>
  );
}

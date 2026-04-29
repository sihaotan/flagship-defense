# 🚀 LaunchDarkly Mothership Defense v1.0

Defend the mothership using feature flags in real-time.

This is a fast-paced survival game built to demonstrate how LaunchDarkly feature flags can directly control application behavior—using gameplay as the interface.

## 🎮 Game Overview

Players defend the LaunchDarkly mothership by configuring a single feature flag:

- Select weapon variations to defeat monsters
- Use stealth mode (kill switch) to avoid goblins
- Survive as long as possible to increase score

## 🧠 Core Concepts Demonstrated

| LaunchDarkly Concept | In-Game Mechanic |
| --- | --- |
| Variations | Weapon selection |
| Kill Switch | Stealth mode |
| Real-time updates | Instant gameplay response |

## 🕹️ Gameplay Loop

- Game starts at Level 1
- Monsters spawn and move toward the mothership
- Player updates feature flag variations
- Weapons fire automatically based on flag state
- If monsters reach the ship → Game Over
- Score increases over time
- Level increases every 15 seconds (max Level 3)

## 🧩 Feature Flag Setup (Required)

**Flag:** `weapon_type_flag`

Create a string variation flag in LaunchDarkly with the following variations:

```json
{
  "key": "weapon_type_flag",
  "variations": [
    "fire",
    "water",
    "laser beam",
    "fire and water",
    "fire and laser beam",
    "water and laser beam",
    "fire, water and laser beam",
    "stealth mode"
  ]
}
```

## 🔥 Variation Meanings

| Variation | Behavior |
| --- | --- |
| `fire` | Fire weapon |
| `water` | Water weapon |
| `laser beam` | Laser weapon |
| `fire and water` | Dual attack |
| `fire and laser beam` | Dual attack |
| `water and laser beam` | Dual attack |
| `fire, water and laser beam` | Triple attack |
| `stealth mode` | Disable weapons (kill switch) |

## ⚠️ Important Behavior

When flag = `stealth mode`:

- Weapons disabled
- Ship enters stealth
- Required to survive goblins

## 👾 Monster System

### Monster Types

| Monster | Weakness |
| --- | --- |
| 🌿 Leaf Monster | Fire |
| 🔥 Fire Monster | Water |
| 🪨 Stone Monster | Laser |
| 👺 Goblin | Stealth Mode |

### Behavior

**Standard monsters:**

- Spawn at top
- Move toward ship
- Must be destroyed before reaching ship

**Goblin:**

- Appears in Level 3
- Cannot be destroyed
- Requires stealth mode
- If it touches ship while weapons are active → Game Over

## 🎯 Level Design

### Level 1 (0–15s)

- 1 monster type
- Match correct weapon

### Level 2 (15–30s)

- 2 monster types
- Use combined variations

### Level 3 (30s+)

- Mixed monster waves (1–3 types)
- Goblins appear randomly
- Must switch between attack and stealth

## 💥 Failure Conditions

- Wrong weapon → monster reaches ship
- Multiple monsters not handled correctly
- Goblin reaches ship while NOT in stealth mode
- Stealth timer reaches 0

## ⏱️ Scoring

`+100` points per `100ms` survived.

## 🧪 Game States

`INIT → INSTRUCTION → RUNNING → GAME_OVER → INSTRUCTION`

- **INIT:** Prompt for LaunchDarkly Client-side ID
- **INSTRUCTION:** Show how to play
- **RUNNING:** Active gameplay
- **GAME_OVER:** Show score + restart

## 🖥️ UI Features

- LaunchDarkly connection status (green indicator)
- Score counter
- Level indicator
- Active monsters
- Current flag variation displayed
- Stealth timer (10s limit)
- Game Over modal with restart

## ⚙️ Technical Notes

- Uses LaunchDarkly Client-side SDK
- Flag values are the single source of truth
- Game reacts to flag updates in real-time
- Local caching used for smooth gameplay

## 🖼️ Screenshot

Mothership Defense Gameplay

## 🚀 Getting Started

1. Clone the repo
2. Create `weapon_type_flag` in LaunchDarkly
3. Copy your Client-side ID
4. Run the app
5. Enter Client-side ID when prompted
6. Start defending 🚀

## 💡 Why This Exists

This project turns LaunchDarkly into a live, interactive demo:

Instead of explaining feature flags…

👉 You play them.
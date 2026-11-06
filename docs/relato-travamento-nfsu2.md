**Title:** Free roam: 3 failures in sub_00433ad0, reached from showoff_car (2 freezes, 1 "exited with code 134")

**What happened**

Three failures in about 35 minutes on 2026-11-03, all in free roam with dozens of players, about 04:22, 04:38 and 04:57 UTC.

The third one stopped the game with code 134 after 1019 s (`RuntimeError: memory access out of bounds`, f=104047 or just after). Its stack has the function names:

```
sub_00433ad0
sub_00433d10
sub_00433db1
dispatch_indirect
car_apply
showoff_car
roam_game_frame
roam_hook
guest_hook
sub_005811c0
```

The first two froze the picture without an error screen. Each logged the same null call five times, then the watchdog reported no Present, with thread 0 holding the GIL at `esp=0x05feedc4 eip=0x00433c9a`:

```
[showoff] f=105953 slot 14: hood closes (kind 0)     (first freeze)
[showoff] f=27535 slot 30: hood closes (kind 0)      (second freeze)

[UNRESOLVED INDIRECT CALL] target=0x00000000  return=0x00433c9a
    eax=00000000 ecx=00000000 edx=0078625e ebx=00000000 esi=00000000 edi=1f4e4cd7
    target NOT COMMITTED (not data, a garbage pointer)
```

Guest stack of the freezes:

```
[ 0] 0x00433c9a sub_00433ad0 + 0x1ca
[ 1] 0x00433d2e sub_00433d10 + 0x1e
[ 2] 0x00433dd9 sub_00433db1 + 0x28
[ 3] 0x00581475 sub_005811c0 + 0x2b5
[ 4] 0x0041c262 sub_0041c100 + 0x162
[ 5] 0x004284d2 sub_00428490 + 0x42
[ 6] 0x004286b6 sub_00428630 + 0x86
[ 7] 0x0042a925 sub_0042a860 + 0xc5
[ 8] 0x0040befe sub_0040bea0 + 0x5e
[ 9] 0x00608c8c sub_006076d0 + 0x15bc
```

**What the logs show, and what they do not**

- All three pass through `sub_00433ad0`, `sub_00433d10` and `sub_00433db1`. Only the third names `showoff_car`, so I assume the freezes come from there too, because their last event is a `[showoff]` line.
- Closing a hood is not enough to cause it. Six other cars closed theirs with no problem (RX7, SUPRA, PEUGOT106, HUMMER, SKYLINE, LANCEREVO8).
- Both freezes were `player-1ygb`'s SKYLINE, but the same player's SKYLINE closed its hood without a problem at f=25853 of the third session. So it does not look specific to that car.
- The third failure logged no hood closing just before it. The last `[showoff]` lines are for slot 16, `player-q5zi`'s CIVIC, whose parts opened at f=103142 to f=103470. I do not know which car it was applying when it trapped.
- A countdown was started shortly before the two freezes. Many other countdowns did not freeze the game, so I do not think it is the cause by itself.

**A fourth failure, same stack**

The same `RuntimeError: memory access out of bounds` happened at 06:58 UTC, exit code 134 after 604.5 s, with the same stack from `sub_00433ad0` to `showoff_car`. Log: `nfsu2-2026-11-03_035838.log`.

- No compile or other heavy work was running this time, so that is not the cause.
- This time the launcher ran its own build of the same Electron and Chromium versions (profile-guided optimization, plus changes so that storage errors never delete data). The first three were on the official Electron build, so the engine build does not change the failure.
- Last lines before the trap: `f=115862 slot 10: loading player-sn2r's RSX (93 parts, skin 15, handle 0x990)`, right after `slot 10: car of our own created`. About 900 frames earlier: `f=114978 the game throws the part animations away: 6 of ours unloaded first`. The same line at f=26867 and f=93392 was not followed by a failure, so it is not enough by itself.

**The same failure on another player's PC, in Firefox**

Another player sent me a log with the same stack at the same offset (`sub_00433ad0`, `wasm-function[6150]:0x91068d`, up through `showoff_car`), exit code 134 after 3372.3 s. Firefox words the error differently (`RuntimeError: index out of bounds`). Log: `nfsu2-2026-11-03_014410.log`.

- Firefox 159 on Windows, NVIDIA, 20 cores, 1920x1080 at 60 Hz, installed as a Home Screen app, same game module `44c9024d`. So it does not depend on the launcher, on Chromium or on my PC.
- Last lines before the trap: `f=138785 slot 15` and `slot 17: car removed (left)`, right after a load of a 240SX at f=138782. No `[showoff]` line in the last 560 frames (the last is `f=138225 slot 20: hood opens`). In both code 134 logs, cars were being loaded and removed just before the trap, but that happens all the time in free roam, so I can't say it is related.

**Setup**

- Game module `44c9024d`, remote server
- Windows 11, RTX 4060, Ryzen 5 9600X, 32 GB, 2560x1440 at 240 Hz
- `NFSU2_RENDER=scale:2`, `NFSU2_FPS=240`
- Played in NFS Launcher, a community desktop wrapper for the site (Electron 45.1.0 / Chromium 156). It does not inject scripts or change the game. I have not tried this in Chrome.
- A large C++ compile was running on the same PC during the first three, but not the fourth. No out-of-memory or device-lost errors are in the logs.

Four logs are attached: `nfsu2-2026-11-03_013902.log` (freezes 1 and 2), `nfsu2-2026-11-03_015730.log` (freeze 2 and the first code 134), `nfsu2-2026-11-03_035838.log` (the second code 134) and `nfsu2-2026-11-03_014410.log` (the other player, in Firefox). The game replaced names and addresses in them.

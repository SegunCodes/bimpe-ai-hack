---
mode: autonomous
message: "One AI phone call before dispatch turns a vague Lagos address into a confirmed delivery."
duration: 30
canvas: 1920x1080
structure: monolithic (index.html, five .scene layers on one paused timeline)
music: none (muted hero loop)
---

## Frame 1
status: animated
src: index.html#s1
time: 0.0–5.0
blueprint: typewriter-reveal (Hook variant)
beat: A delivery label types "No 12, by the yellow gate, opp. the mosque, Lekki"; the vague phrase gets a red circle and "?" stamp while a rider pin wanders a looping route on a faint street map.
transition-out: vertical push, 0.5s power3.inOut @ 4.6

## Frame 2
status: animated
src: index.html#s2
time: 5.0–9.0
blueprint: kinetic-type-beats (Problem → Product_Intro, multi-beat statement build)
beat: "The rider is 10 minutes away." → "Nobody called first." (red strike) → "Tellero calls first." with a yellow selection box on Tellero and a phone tile spring-pop.
transition-out: circle iris from the phone tile, 0.6s power2.out @ 8.6 (hero reveal accent)

## Frame 3
status: animated
src: index.html#s3
time: 9.0–19.0
blueprint: agent-progress-theater (thread payoff, sub-shape B)
beat: Pidgin call thread builds bubble by bubble with a live waveform; the order card mutates in step: address strikes and retypes clean, landmark pin drops, status Scheduled → Calling → Address updated, then a green "Ready for dispatch" stamp under a slow push-in.
transition-out: vertical push, 0.5s power3.inOut @ 18.6

## Frame 4
status: animated
src: index.html#s4
time: 19.0–25.0
blueprint: grid-card-assemble (live-populate variant)
beat: "Every order. Every language." Five language chips cascade with their greeting; an orders board populates row by row and status pills step live to confirmed / rescheduled / address updated.
transition-out: blur crossfade, 0.7s sine.inOut @ 24.5 (wind-down)

## Frame 5
status: animated
src: index.html#s5
time: 25.0–30.0
blueprint: logo-assemble-lockup (CTA text-clear bloom)
beat: The yellow phone mark spring-blooms at center, rings ripple once, slides left as the "Tellero" wordmark unmasks; tagline types "Confirmed before the rider leaves."; final 0.5s fades to ink so the loop restarts cleanly.

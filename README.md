# Lumière — 3D Paris Driving

Free-drive Paris at golden hour, on the [Golden Hour](https://github.com/icomppower/golden-hour-engine)
3D city-driving engine. Fourth city in the series.

**Live:** https://icomppower.github.io/paris-drive/

The Seine is a real curving channel with the Île de la Cité and the Île Saint-Louis
in it and twelve drivable bridges across it; twelve avenues radiate from the
Étoile; the Montmartre butte carries Sacré-Cœur; and the Haussmann fabric is
generated as continuous street walls rather than freestanding blocks.

- `W A S D` / arrows drive · `SPACE` drift · `C` camera · `R` reset · `T` landmark tour
- Deep link to any spot with `#at=<x>,<z>[,<heading>]`; add `#debug` for generation counts.

`engine.js` is vendored from the engine repo — refresh it with that repo's `sync.sh`.
The city itself is entirely in `cities/paris.js`, and also runs on the hub demo as
`?city=paris`.

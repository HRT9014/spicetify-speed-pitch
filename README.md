# Speed & Pitch

A player-bar button for Spotify desktop with two tools: a real speed control for songs, and a finder for slowed and sped-up versions.

## Speed

Pick 0.75x, 0.85x, 1x, 1.15x, 1.25x or 1.5x, or drag the slider (0.5x to 2x). The song you're playing and everything queued after it then plays at that speed. Reset goes back to normal. The button lights up and its tooltip shows the speed while it's not 1x.

### How it works

Spotify's player has a native per-song speed setting (`item.speed`). Its `setSpeed` call refuses music (`not_supported_by_content_type`), but the native engine applies `item.speed` from a track's metadata when it plays one. The extension re-opens your queue (up to 10 previous songs, the current song and everything upcoming) as a custom context in which every song carries `item.speed`, starting at the same song and position.

Measured on this PC (position advance against the wall clock): 0.75x gives 0.748, 1.25x gives 1.248, and the speed stays through next/previous, seek and pause/resume.

### Limits

- Your playlist becomes a copy of the queue, so "Playing from" changes. The copy is limited to what Spotify exposes (about 80 upcoming songs), and playback stops when it runs out.
- Shuffle is switched off while speed is on, so the queue order is kept. Reset brings back your original playlist and your shuffle setting when it can.
- If you start something else while speed is on, the speed is re-applied once the new song starts (a short restart of that song).
- The speed is remembered. After a restart it is applied again when playback starts.
- Songs only, not podcasts or ads, and only while this PC is the active device.
- The time and progress bar show the original song length, not the stretched time.
- Pitch has not been measured, and the extension makes no claim about it.

### Not yet verified

Reset restoring the original playlist, the shuffle-off path, how long the re-apply glitch lasts, and the "speed list finished" notice. They are implemented but were not tested live.

## Versions

The same panel lists slowed, sped-up and nightcore versions of the playing song. Click a row to play it, or use **+** to add it to the queue.

Matching is strict. A result must have exactly the same song title as the playing song (ignoring `feat.` credits, punctuation and accents) and carry an explicit tag such as `Slowed`, `Sped Up`, `Nightcore`, `Reverb` or a `0.8x` label. Other songs that only share the artist, or just contain the word "slowed", are never listed. Versions by the same artist come first. Uploads by other accounts are listed under **Other uploaders**, and they must be the plain title plus a tag (extra words such as "Hardstyle" or "Instrumental" are rejected). "Same artist only" hides them.

If nothing qualifies, the panel says so and offers a shortcut to Spotify's search.

## Install

### Marketplace (easiest)

Open Spicetify Marketplace, go to Extensions, search for **Speed & Pitch** and click Install.

### Manual

1. Copy `speedPitch.js` to the Spicetify `Extensions` folder (`%appdata%\spicetify\Extensions`).
2. Run `spicetify config extensions speedPitch.js`, then `spicetify apply`.

Search uses Spotify's own in-app search, so it needs no login or API key.

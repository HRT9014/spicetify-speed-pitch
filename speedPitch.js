(async function SpeedPitch() {
	window.__speedPitch?.dispose();

	while (!(window.Spicetify?.Player?.addEventListener && Spicetify.Playbar?.Button && Spicetify.GraphQL?.Definitions && Spicetify.LocalStorage && Spicetify.showNotification && Spicetify.Platform?.History && Spicetify.Platform?.PlayerAPI)) {
		await new Promise(r => setTimeout(r, 300));
	}

	const SAME_ARTIST_KEY = "speedPitch:sameArtistOnly";
	const SPEED_KEY = "speedPitch:speed";
	const ORIG_KEY = "speedPitch:origContext";
	const SPEED_META = "item.speed";
	const CUSTOM_URI = "spotify:internal:speedpitch";
	const PRESETS = [0.75, 0.85, 1, 1.15, 1.25, 1.5];
	const MIN_SPEED = 0.5;
	const MAX_SPEED = 2;
	const PREV_COUNT = 10;
	const COOLDOWN_MS = 4000;
	const CACHE_MS = 10 * 60 * 1000;
	const PER_GROUP = 4;
	const PER_OTHER = 3;
	const TYPO_SIMILARITY = 0.92;
	const QUAL = String.raw`(?:(?:ultra|super|deep|extra|very|mega|hyper|max)\s+)?`;
	const TAG_WORDS = String.raw`${QUAL}slowed(?:\s+down|\s+to\s+perfection)?(?:\s*(?:\+|&|and|n|x)\s*reverb(?:ed)?|\s+reverb(?:ed)?)?|${QUAL}(?:sped[\s-]*up|speed(?:ed)?[\s-]*up|speedup)(?:\s+to\s+perfection)?|nightcore|reverb(?:ed)?|8d(?:\s+audio)?|\d(?:\.\d{1,2})?x|x\d(?:\.\d{1,2})?`;
	const VERSION_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${TAG_WORDS})(?![\p{L}\p{N}])`, "iu");
	const TAIL_RE = new RegExp(String.raw`\s+(?:${TAG_WORDS})\s*$`, "iu");
	const LEAD_RE = new RegExp(String.raw`^\s*(?:${TAG_WORDS})\s*$`, "iu");
	const TAG_ALL_RE = new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${TAG_WORDS})(?![\p{L}\p{N}])`, "giu");
	const FILLER_RE = /(?<![\p{L}\p{N}])(?:version|ver|edit|remix|mix|audio|tiktok|tik\s*tok)(?![\p{L}\p{N}])/giu;
	const FEAT_HEAD_RE = /^\s*(?:feat|ft|featuring|with)\b/i;
	const FEAT_TAIL_RE = /\s+(?:feat|ft|featuring)\.?\s+.+$/i;
	const GROUPS = [
		{ id: "slowed", label: "Slowed", tags: ["Slowed", "Slowed + Reverb", "Reverb"] },
		{ id: "fast", label: "Sped up", tags: ["Sped Up", "Nightcore"] },
	];
	const PRIORITY = { Slowed: 3, "Sped Up": 3, "Slowed + Reverb": 2, Nightcore: 2, Reverb: 1 };

	const ICON_BUTTON = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.4 11.6a6 6 0 1 1 11.2 0"/><path d="M8 9.6l2.6-3.4"/><circle cx="8" cy="9.8" r="1" fill="currentColor" stroke="none"/></svg>`;
	const ICON_PLAY = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4 2.4v11.2a.6.6 0 0 0 .9.5l9-5.6a.6.6 0 0 0 0-1L4.9 1.9a.6.6 0 0 0-.9.5z"/></svg>`;
	const ICON_QUEUE = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`;
	const ICON_REFRESH = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 8A5.2 5.2 0 1 1 11.6 4.3M13.4 2.2v2.6h-2.6"/></svg>`;

	const CSS = `
.sp-panel{position:fixed;z-index:9999;width:372px;max-height:620px;overflow-y:auto;background:var(--spice-card,#1f1f1f);color:var(--spice-text,#fff);border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.55);font-size:13px}
.sp-panel[hidden]{display:none}
.sp-title{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 4px;font-size:15px;font-weight:700}
.sp-speed{display:flex;flex-direction:column;gap:10px;padding:8px 16px 14px;border-bottom:1px solid rgba(255,255,255,.08)}
.sp-speed.busy .sp-pill,.sp-speed.busy .sp-slider,.sp-speed.busy .sp-reset{opacity:.5;pointer-events:none}
.sp-speed-top{display:flex;align-items:center;justify-content:space-between}
.sp-label{color:var(--spice-subtext,#b3b3b3);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.sp-value{font-size:20px;font-weight:800;line-height:1}
.sp-reset{padding:4px 12px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:none;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.sp-reset:hover:not(:disabled){background:rgba(255,255,255,.1)}
.sp-reset:disabled{opacity:.35;cursor:default}
.sp-presets{display:flex;gap:6px}
.sp-pill{flex:1;padding:6px 0;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:none;color:inherit;font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.sp-pill:hover{background:rgba(255,255,255,.1)}
.sp-pill.on{background:var(--spice-button,#fff3c4);border-color:transparent;color:var(--spice-main,#000)}
.sp-slider{width:100%;margin:0;accent-color:var(--spice-button,#fff3c4)}
.sp-status{min-height:16px;color:var(--spice-subtext,#b3b3b3);font-size:11.5px;line-height:1.4}
.sp-status.err{color:#ff9b9b}
.sp-vhead{display:flex;flex-direction:column;gap:7px;padding:12px 16px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
.sp-vtitle{display:flex;align-items:center;justify-content:space-between}
.sp-now{display:flex;align-items:center;gap:8px;min-width:0;color:var(--spice-subtext,#b3b3b3);font-size:12px}
.sp-now-name{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.sp-opt{display:flex;align-items:center;gap:8px;color:var(--spice-subtext,#b3b3b3);font-size:12px;cursor:pointer;user-select:none}
.sp-opt input{accent-color:var(--spice-button,#fff3c4);margin:0}
.sp-body{min-height:72px;padding:4px 8px 8px}
.sp-sec{padding:12px 8px 4px;color:var(--spice-subtext,#b3b3b3);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.sp-subsec{padding:8px 8px 2px;color:var(--spice-subtext,#b3b3b3);font-size:11px;font-weight:600}
.sp-empty,.sp-note{padding:6px 8px;color:var(--spice-subtext,#b3b3b3);line-height:1.45}
.sp-note{padding:14px 8px}
.sp-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px;cursor:pointer}
.sp-row:hover,.sp-row:focus-visible{background:rgba(255,255,255,.08);outline:none}
.sp-cover{flex:none;width:40px;height:40px;border-radius:5px;background:rgba(255,255,255,.08);object-fit:cover}
.sp-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.sp-name{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:600}
.sp-sub{display:flex;align-items:center;gap:6px;min-width:0;color:var(--spice-subtext,#b3b3b3);font-size:12px}
.sp-artists{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0}
.sp-artists.same{color:var(--spice-button,#fff3c4)}
.sp-chip{flex:none;padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;background:rgba(255,255,255,.12);color:#ddd}
.sp-chip[data-tag="Slowed"]{background:rgba(88,166,255,.2);color:#8cc4ff}
.sp-chip[data-tag="Slowed + Reverb"]{background:rgba(129,140,248,.22);color:#b0b6ff}
.sp-chip[data-tag="Reverb"]{background:rgba(45,212,191,.2);color:#6ee7d3}
.sp-chip[data-tag="Sped Up"]{background:rgba(251,146,60,.22);color:#ffb27a}
.sp-chip[data-tag="Nightcore"]{background:rgba(244,114,182,.22);color:#f9a8d4}
.sp-btn{flex:none;display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:50%;background:none;color:var(--spice-subtext,#b3b3b3);cursor:pointer}
.sp-btn:hover{background:rgba(255,255,255,.12);color:var(--spice-text,#fff)}
.sp-link{margin:4px 8px 0 0;padding:6px 12px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:none;color:var(--spice-text,#fff);font:inherit;cursor:pointer}
.sp-link:hover{background:rgba(255,255,255,.1)}
.sp-spin{margin:22px auto;width:22px;height:22px;border:2px solid rgba(255,255,255,.15);border-top-color:var(--spice-button,#fff3c4);border-radius:50%;animation:sp-rot .8s linear infinite}
@keyframes sp-rot{to{transform:rotate(360deg)}}
.sp-foot{padding:9px 16px 11px;border-top:1px solid rgba(255,255,255,.08);color:var(--spice-subtext,#b3b3b3);font-size:11.5px;line-height:1.45}
.sp-foot summary{cursor:pointer;user-select:none}
.sp-foot p{margin:6px 0 0}`;

	const sleep = ms => new Promise(r => setTimeout(r, ms));
	const h = (tag, cls, text) => {
		const e = document.createElement(tag);
		if (cls) e.className = cls;
		if (text != null) e.textContent = text;
		return e;
	};
	const store = {
		get(k, d) {
			try {
				const v = Spicetify.LocalStorage.get(k);
				return v == null ? d : JSON.parse(v);
			} catch {
				return d;
			}
		},
		set(k, v) {
			try {
				Spicetify.LocalStorage.set(k, JSON.stringify(v));
			} catch {}
		},
		remove(k) {
			try {
				Spicetify.LocalStorage.remove(k);
			} catch {}
		},
	};

	const norm = s =>
		String(s || "")
			.toLowerCase()
			.normalize("NFD")
			.replace(/\p{M}+/gu, "")
			.replace(/['’`´]/g, "")
			.replace(/&/g, " and ")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();

	function lev(a, b) {
		let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
		for (let i = 1; i <= a.length; i++) {
			const row = [i];
			for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = row;
		}
		return prev[b.length];
	}

	function sameTitle(a, b, allowTypo) {
		if (!a || !b) return false;
		if (a === b) return true;
		if (!allowTypo || (a.match(/\d+/g) || []).join() !== (b.match(/\d+/g) || []).join()) return false;
		return 1 - lev(a, b) / Math.max(a.length, b.length) >= TYPO_SIMILARITY;
	}

	function tagOf(text) {
		const t = text.toLowerCase();
		if (/nightcore/.test(t)) return "Nightcore";
		if (/sped[\s-]*up|speed(?:ed)?[\s-]*up|speedup/.test(t)) return "Sped Up";
		if (/slowed/.test(t)) return /reverb/.test(t) ? "Slowed + Reverb" : "Slowed";
		if (/reverb/.test(t)) return "Reverb";
		const m = t.match(/(\d(?:\.\d{1,2})?)x|x(\d(?:\.\d{1,2})?)/);
		const v = m ? parseFloat(m[1] ?? m[2]) : 1;
		return v < 1 ? "Slowed" : v > 1 ? "Sped Up" : null;
	}

	const isTagOnly = s => !s.replace(TAG_ALL_RE, " ").replace(FILLER_RE, " ").replace(/[^\p{L}\p{N}]+/gu, "");

	function parseTitle(name, artistNorms, lenient) {
		const tags = [];
		const isTag = s => VERSION_RE.test(s) && (lenient || isTagOnly(s));
		let s = String(name || "").replace(/\s*[(\[{][^)\]}]*[)\]}]/g, m => {
			const inner = m.replace(/^\s*[(\[{]|[)\]}]\s*$/g, "");
			if (isTag(inner)) return tags.push(inner), "";
			return FEAT_HEAD_RE.test(inner) ? "" : m;
		});
		const parts = s.split(/\s+[-–—|~]\s*|\s*[-–—|~]\s+/);
		while (parts.length > 1 && (isTag(parts[parts.length - 1]) || FEAT_HEAD_RE.test(parts[parts.length - 1]))) {
			const p = parts.pop();
			if (VERSION_RE.test(p)) tags.push(p);
		}
		if (parts.length > 1 && LEAD_RE.test(parts[0])) tags.push(parts.shift());
		if (parts.length > 1 && artistNorms?.has(norm(parts[0]))) parts.shift();
		s = parts.join(" - ");
		for (let again = true; again; ) {
			again = false;
			let m = s.match(TAIL_RE);
			if (m) {
				tags.push(m[0]);
				s = s.slice(0, m.index);
				again = true;
				continue;
			}
			m = s.match(FEAT_TAIL_RE);
			if (m) {
				s = s.slice(0, m.index);
				again = true;
			}
		}
		const tagText = tags.join(" ");
		return { base: s.trim(), key: norm(s), tagText, tag: tagOf(tagText) };
	}

	function pickCover(sources) {
		const list = (sources || []).filter(s => typeof s.url === "string" && s.url.startsWith("https://i.scdn.co/"));
		return (list.find(s => s.width === 64) || list[0])?.url || "";
	}

	async function searchTracks(term) {
		const def = Spicetify.GraphQL.Definitions.searchModalResults;
		if (!def) throw new Error("search isn't available in this Spotify version");
		const r = await Spicetify.GraphQL.Request(def, {
			searchTerm: term,
			offset: 0,
			limit: 20,
			numberOfTopResults: 20,
			includeAudiobooks: false,
			includeArtistHasConcertsField: false,
			includePreReleases: false,
			includeAuthors: false,
		});
		if (r?.errors?.length) throw new Error(r.errors[0].message || "search error");
		return (r?.data?.searchV2?.topResultsV2?.itemsV2 ?? [])
			.map(i => i.item?.data)
			.filter(d => d?.__typename === "Track" && d.uri)
			.map(d => ({
				uri: d.uri,
				name: d.name || "",
				artists: (d.artists?.items ?? []).map(a => a.profile?.name).filter(Boolean),
				cover: pickCover(d.albumOfTrack?.coverArt?.sources),
			}));
	}

	async function findVersions(track) {
		const artistNorms = new Set(track.artists.map(norm));
		const cur = parseTitle(track.name, artistNorms, true);
		if (!cur.key) return [];
		const a0 = track.artists[0] || "";
		const terms = [`${cur.base} ${a0} slowed`, `${cur.base} ${a0} sped up`, `${cur.base} slowed`, `${cur.base} sped up`, `${cur.base} nightcore`];
		const settled = await Promise.allSettled(terms.map(t => searchTracks(t)));
		const ok = settled.filter(s => s.status === "fulfilled");
		if (!ok.length) throw settled[0].reason;
		const seen = new Map();
		ok.forEach(s => s.value.forEach(t => seen.has(t.uri) || seen.set(t.uri, t)));
		const dupeKey = (p, artists) => `${p.key}|${norm(p.tagText)}|${[...artists].sort().join(",")}`;
		const dupes = new Set([dupeKey(cur, artistNorms)]);
		const out = [];
		let order = 0;
		for (const t of seen.values()) {
			order++;
			if (t.uri === track.uri) continue;
			const candArtists = t.artists.map(norm);
			const sameArtist = candArtists.some(a => artistNorms.has(a));
			const p = parseTitle(t.name, new Set([...artistNorms, ...candArtists]), sameArtist);
			if (!p.tag) continue;
			if (!sameTitle(cur.key, p.key, sameArtist)) continue;
			const dk = dupeKey(p, candArtists);
			if (dupes.has(dk)) continue;
			dupes.add(dk);
			out.push({ ...t, tag: p.tag, sameArtist, rank: (sameArtist ? 1000 : 0) + (p.key === cur.key ? 100 : 90) + (PRIORITY[p.tag] || 0) * 10 - order * 0.01 });
		}
		out.sort((a, b) => b.rank - a.rank);
		return out;
	}

	function currentTrack() {
		const item = Spicetify.Player.data?.item;
		if (!item || item.type !== "track" || item.isLocal || !item.name) return null;
		return { uri: item.uri, name: item.name, artists: (item.artists || []).map(a => a.name).filter(Boolean) };
	}

	const player = () => Spicetify.Platform.PlayerAPI;
	const isTrackUri = uri => typeof uri === "string" && uri.startsWith("spotify:track:");
	const fmtSpeed = s => `${+s.toFixed(2)}x`;
	const clampSpeed = s => {
		const n = Number(s);
		return Number.isFinite(n) ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(n * 100) / 100)) : 1;
	};
	const metaSpeed = item => parseFloat(item?.metadata?.[SPEED_META]) || 1;
	const hasSpeed = item => !!item?.metadata?.[SPEED_META];

	let speed = clampSpeed(store.get(SPEED_KEY, 1));
	let orig = store.get(ORIG_KEY, null);
	let shuffleSet = null;
	let finalUid = null;
	let lastApplyAt = 0;
	let applying = false;
	let chain = Promise.resolve();
	const tried = new Map();

	async function waitFor(pred, timeout = 3000) {
		const end = Date.now() + timeout;
		while (Date.now() < end) {
			const v = pred();
			if (v) return v;
			await sleep(100);
		}
		return null;
	}

	function remoteDevice() {
		const d = Spicetify.Platform.ConnectAPI?.state?.activeDevice;
		return !!d && d.id !== "local_device";
	}

	function buildList(st, s) {
		const q = Spicetify.Queue;
		const cur = st.item;
		const fresh = q?.track?.contextTrack?.uid === cur.uid;
		const flat = arr => (arr || []).map(x => x?.contextTrack || x).filter(t => t?.uri && !t.uri.startsWith("spotify:delimiter"));
		const prev = flat(fresh && q.prevTracks?.length ? q.prevTracks : st.previousItems).slice(-PREV_COUNT);
		const queued = fresh ? (q.nextTracks || []).filter(x => !x.removed?.length && !x.blocked?.length) : st.nextItems;
		const next = flat(queued);
		const seen = new Set([cur.uid]);
		const entry = t => {
			const e = { uri: t.uri, uid: t.uid };
			if (s !== 1 && isTrackUri(t.uri)) e.metadata = { [SPEED_META]: String(s) };
			return e;
		};
		const items = [];
		for (const t of prev) if (t.uid && !seen.has(t.uid)) (seen.add(t.uid), items.push(entry(t)));
		items.push(entry(cur));
		for (const t of next) if (t.uid && !seen.has(t.uid)) (seen.add(t.uid), items.push(entry(t)));
		return items;
	}

	const customContext = items => ({ uri: CUSTOM_URI, url: "context://" + CUSTOM_URI, pages: [{ items }] });

	async function playItems(item, items, shuffle, pos, paused) {
		await player().play(customContext(items), {}, { skipTo: { uid: item.uid, uri: item.uri }, seekTo: pos, paused, shuffle });
	}

	async function doApply(s) {
		const P = player();
		const before = speed;
		speed = s;
		store.set(SPEED_KEY, s);
		syncSpeedUi();
		const st = P.getState();
		const item = st?.item;
		if (!item) return say(s === 1 ? "Normal speed" : `Saved ${fmtSpeed(s)}. It applies when a song plays.`);
		if (!isTrackUri(item.uri)) return say(s === 1 ? "Normal speed" : `Saved ${fmtSpeed(s)}. It applies to the next song.`);
		if (remoteDevice()) {
			speed = before;
			store.set(SPEED_KEY, before);
			syncSpeedUi();
			return say("Speed only works when this PC is the active device", true);
		}
		const ours = st.context?.uri === CUSTOM_URI;
		if (s === 1) return restoreNormal(st, ours);
		if (!ours) {
			orig = { uri: st.context?.uri || null, shuffle: !!st.shuffle };
			store.set(ORIG_KEY, orig);
		}
		const items = buildList(st, s);
		await playItems(item, items, false, Spicetify.Player.getProgress(), !!st.isPaused);
		const ok = await waitFor(() => {
			const x = P.getState();
			return x.item?.uri === item.uri && hasSpeed(x.item) ? x : null;
		}, 3500);
		if (!ok) throw new Error("Spotify didn't accept the speed setting");
		shuffleSet = ok.shuffle;
		say(`${fmtSpeed(s)} on ${items.filter(i => i.metadata).length} songs`);
	}

	async function restoreNormal(st, ours) {
		const P = player();
		const item = st.item;
		if (!ours) return say("Normal speed");
		const pos = Spicetify.Player.getProgress();
		const paused = !!st.isPaused;
		const userChanged = shuffleSet !== null && st.shuffle !== shuffleSet;
		const target = userChanged ? st.shuffle : (orig?.shuffle ?? st.shuffle);
		let restored = false;
		if (orig?.uri && !orig.uri.startsWith("spotify:track:") && orig.uri !== CUSTOM_URI) {
			try {
				await P.play({ uri: orig.uri }, {}, { skipTo: { uri: item.uri }, seekTo: pos, paused, shuffle: target });
				restored = !!(await waitFor(() => {
					const x = P.getState();
					return x.item?.uri === item.uri && x.context?.uri === orig.uri && !hasSpeed(x.item) ? x : null;
				}, 3500));
			} catch {}
		}
		if (!restored) {
			await playItems(item, buildList(st, 1), target, pos, paused);
			await waitFor(() => (P.getState().item?.uri === item.uri ? 1 : 0), 3000);
		}
		orig = null;
		store.remove(ORIG_KEY);
		shuffleSet = null;
		say(restored ? "Normal speed. Your original playlist is back." : "Normal speed. Your queue stays as a copy of the playlist.");
	}

	function applySpeed(s) {
		const run = async () => {
			const before = speed;
			applying = true;
			setBusy(true);
			try {
				await doApply(clampSpeed(s));
			} catch (e) {
				if (clampSpeed(s) !== 1) {
					speed = before;
					store.set(SPEED_KEY, before);
				}
				say(`Couldn't apply speed (${String(e?.message || e).slice(0, 90)})`, true);
			} finally {
				applying = false;
				lastApplyAt = Date.now();
				setBusy(false);
				syncSpeedUi();
			}
		};
		chain = chain.then(run, run);
		return chain;
	}

	function watchListEnd(st) {
		const it = st?.item;
		if (speed === 1 || st?.context?.uri !== CUSTOM_URI) {
			finalUid = null;
			return;
		}
		if (finalUid && (!it || (it.uid === finalUid && st.isPaused && st.positionAsOfTimestamp >= (st.duration || Infinity) - 2000))) {
			finalUid = null;
			Spicetify.showNotification("Speed list finished. Start another song to keep the speed.");
		} else if (it && !st.isPaused && !(st.nextItems || []).length) finalUid = it.uid;
		else if (it && finalUid && it.uid !== finalUid) finalUid = null;
	}

	function onPlayerUpdate(e) {
		const st = e?.data || player().getState();
		const it = st?.item;
		watchListEnd(st);
		if (speed === 1 || applying || !it || st.isPaused || !isTrackUri(it.uri)) return;
		if (Date.now() - lastApplyAt < COOLDOWN_MS || remoteDevice()) return;
		if (hasSpeed(it) && metaSpeed(it) === speed) return;
		const key = `${it.uid}:${speed}`;
		if (Date.now() - (tried.get(key) || 0) < 60000) return;
		tried.set(key, Date.now());
		if (tried.size > 200) tried.delete(tried.keys().next().value);
		applySpeed(speed);
	}

	const style = h("style");
	style.id = "speedpitch-style";
	style.textContent = CSS;
	document.head.appendChild(style);

	const panel = h("div", "sp-panel");
	panel.hidden = true;
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Speed and versions");
	panel.append(h("div", "sp-title", "Speed & versions"));

	const speedBox = h("div", "sp-speed");
	const speedTop = h("div", "sp-speed-top");
	const speedLabel = h("span", "sp-label", "Speed");
	const speedValue = h("span", "sp-value");
	const resetBtn = h("button", "sp-reset", "Reset");
	speedTop.append(speedLabel, speedValue, resetBtn);
	const presets = h("div", "sp-presets");
	const pills = PRESETS.map(v => {
		const b = h("button", "sp-pill", v === 1 ? "1x" : `${v}x`);
		b.addEventListener("click", () => applySpeed(v));
		presets.append(b);
		return { v, b };
	});
	const slider = h("input", "sp-slider");
	slider.type = "range";
	slider.min = String(MIN_SPEED);
	slider.max = String(MAX_SPEED);
	slider.step = "0.05";
	slider.setAttribute("aria-label", "Speed");
	const speedStatus = h("div", "sp-status");
	speedBox.append(speedTop, presets, slider, speedStatus);
	panel.append(speedBox);

	const vhead = h("div", "sp-vhead");
	const vtitle = h("div", "sp-vtitle");
	vtitle.append(h("span", "sp-label", "Slowed & sped-up versions"));
	const refresh = h("button", "sp-btn");
	refresh.title = "Search again";
	refresh.innerHTML = ICON_REFRESH;
	vtitle.append(refresh);
	const now = h("div", "sp-now");
	const optLabel = h("label", "sp-opt");
	const sameOnly = h("input");
	sameOnly.type = "checkbox";
	sameOnly.checked = store.get(SAME_ARTIST_KEY, false);
	optLabel.append(sameOnly, h("span", "", "Same artist only"));
	vhead.append(vtitle, now, optLabel);
	const body = h("div", "sp-body");
	const foot = h("details", "sp-foot");
	foot.append(
		h("summary", "", "How speed works"),
		h("p", "", "Speed uses Spotify's own per-song speed setting. Your queue is re-opened as a copy where every song carries the speed, so \"Playing from\" changes and shuffle stays off while speed is on. Reset brings your original playlist back when it can. It only works while this PC is the active device.")
	);
	panel.append(vhead, body, foot);
	document.body.appendChild(panel);

	const cache = new Map();
	const state = { status: "idle", track: null, results: [], error: "" };
	let searchId = 0;
	let button;

	function say(text, isError) {
		speedStatus.textContent = text || "";
		speedStatus.classList.toggle("err", !!isError);
	}

	function setBusy(b) {
		speedBox.classList.toggle("busy", b);
		if (b) say("Applying speed...");
	}

	function syncSpeedUi() {
		speedValue.textContent = fmtSpeed(speed);
		slider.value = String(speed);
		resetBtn.disabled = speed === 1;
		pills.forEach(({ v, b }) => b.classList.toggle("on", Math.abs(v - speed) < 0.001));
		if (button) {
			button.label = speed === 1 ? "Speed & versions" : `Speed ${fmtSpeed(speed)}`;
			button.active = speed !== 1 || !panel.hidden;
		}
	}

	function note(text) {
		return h("div", "sp-note", text);
	}

	function chip(tag) {
		const c = h("span", "sp-chip", tag);
		c.dataset.tag = tag;
		return c;
	}

	function iconButton(svg, title, onClick) {
		const b = h("button", "sp-btn");
		b.title = title;
		b.setAttribute("aria-label", title);
		b.innerHTML = svg;
		b.addEventListener("click", e => {
			e.stopPropagation();
			onClick();
		});
		return b;
	}

	function playTrack(t) {
		try {
			Spicetify.Player.playUri(t.uri);
		} catch {
			Spicetify.showNotification("Couldn't play that version", true);
		}
	}

	async function queueTrack(t) {
		try {
			await Spicetify.addToQueue([{ uri: t.uri }]);
			Spicetify.showNotification("Added to queue");
		} catch {
			Spicetify.showNotification("Couldn't add to queue", true);
		}
	}

	function row(c) {
		const el = h("div", "sp-row");
		el.tabIndex = 0;
		el.setAttribute("role", "button");
		if (c.cover) {
			const img = h("img", "sp-cover");
			img.src = c.cover;
			img.alt = "";
			img.loading = "lazy";
			el.append(img);
		} else el.append(h("div", "sp-cover"));
		const info = h("div", "sp-info");
		info.append(h("div", "sp-name", c.name));
		const sub = h("div", "sp-sub");
		const artists = h("span", c.sameArtist ? "sp-artists same" : "sp-artists", c.artists.join(", "));
		artists.title = c.sameArtist ? "Same artist as the current song" : "Other uploader";
		sub.append(chip(c.tag), artists);
		info.append(sub);
		el.append(info, iconButton(ICON_QUEUE, "Add to queue", () => queueTrack(c)), iconButton(ICON_PLAY, "Play this version", () => playTrack(c)));
		el.addEventListener("click", () => playTrack(c));
		el.addEventListener("keydown", e => {
			if (e.key === "Enter") playTrack(c);
		});
		return el;
	}

	function searchLink(label, query) {
		const b = h("button", "sp-link", label);
		b.addEventListener("click", () => {
			Spicetify.Platform.History.push("/search/" + encodeURIComponent(query));
			closePanel();
		});
		return b;
	}

	function render() {
		const t = state.track;
		const artistNorms = new Set((t?.artists || []).map(norm));
		now.replaceChildren();
		if (t) {
			const p = parseTitle(t.name, artistNorms, true);
			now.append(h("span", "sp-now-name", t.artists.length ? `${t.name} · ${t.artists.join(", ")}` : t.name));
			if (p.tag) now.append(chip(p.tag));
		}
		body.replaceChildren();
		if (state.status === "unsupported") {
			body.append(note("Play a regular Spotify song to look for slowed and sped-up versions. Podcasts, ads and local files don't have any."));
			return;
		}
		if (state.status === "loading") {
			body.append(h("div", "sp-spin"));
			return;
		}
		if (state.status === "error") {
			body.append(note(`Search failed: ${state.error}`));
			return;
		}
		if (state.status !== "ready") return;
		const baseTerm = `${parseTitle(t.name, artistNorms, true).base} ${t.artists[0] || ""}`.trim();
		const lists = GROUPS.map(g => {
			const all = state.results.filter(c => g.tags.includes(c.tag));
			return {
				g,
				same: all.filter(c => c.sameArtist).slice(0, PER_GROUP),
				other: sameOnly.checked ? [] : all.filter(c => !c.sameArtist).slice(0, PER_OTHER),
			};
		});
		if (!lists.some(x => x.same.length || x.other.length)) {
			const box = h("div", "sp-note", sameOnly.checked && state.results.length ? "Only other uploaders have versions of this song. Untick \"Same artist only\" to see them." : "No exact slowed or sped-up version of this song was found on Spotify.");
			box.append(h("br"));
			box.append(searchLink("Search Spotify: slowed", `${baseTerm} slowed`), searchLink("Search Spotify: sped up", `${baseTerm} sped up`));
			body.append(box);
			return;
		}
		for (const { g, same, other } of lists) {
			body.append(h("div", "sp-sec", g.label));
			if (!same.length && !other.length) {
				body.append(h("div", "sp-empty", `No ${g.label.toLowerCase()} version found`));
				continue;
			}
			same.forEach(c => body.append(row(c)));
			if (other.length) {
				body.append(h("div", "sp-subsec", "Other uploaders"));
				other.forEach(c => body.append(row(c)));
			}
		}
	}

	async function load(force) {
		const id = ++searchId;
		const t = currentTrack();
		state.track = t;
		if (!t) {
			state.status = "unsupported";
			state.results = [];
			render();
			return;
		}
		const hit = cache.get(t.uri);
		if (hit && !force && Date.now() - hit.at < CACHE_MS) {
			state.status = "ready";
			state.results = hit.results;
			render();
			return;
		}
		state.status = "loading";
		render();
		try {
			const results = await findVersions(t);
			if (id !== searchId) return;
			cache.set(t.uri, { at: Date.now(), results });
			if (cache.size > 50) cache.delete(cache.keys().next().value);
			state.results = results;
			state.status = "ready";
		} catch (e) {
			if (id !== searchId) return;
			state.status = "error";
			state.error = String(e?.message || e).slice(0, 120);
		}
		render();
	}

	function place() {
		const r = button.element.getBoundingClientRect();
		const w = panel.offsetWidth || 372;
		const gap = 10;
		const above = r.top - gap - 8;
		const below = window.innerHeight - r.bottom - gap - 8;
		const up = above >= below;
		panel.style.maxHeight = Math.min(620, Math.max(200, up ? above : below)) + "px";
		panel.style.left = Math.min(Math.max(8, r.right - w + 28), window.innerWidth - w - 8) + "px";
		panel.style.top = up ? "auto" : r.bottom + gap + "px";
		panel.style.bottom = up ? window.innerHeight - r.top + gap + "px" : "auto";
	}

	function onDocPointer(e) {
		if (!panel.contains(e.target) && !button.element.contains(e.target)) closePanel();
	}

	function onKey(e) {
		if (e.key === "Escape") closePanel();
	}

	function openPanel() {
		panel.hidden = false;
		syncSpeedUi();
		place();
		document.addEventListener("mousedown", onDocPointer, true);
		document.addEventListener("keydown", onKey, true);
		window.addEventListener("resize", place);
		load(false);
	}

	function closePanel() {
		panel.hidden = true;
		syncSpeedUi();
		document.removeEventListener("mousedown", onDocPointer, true);
		document.removeEventListener("keydown", onKey, true);
		window.removeEventListener("resize", place);
	}

	function onSongChange() {
		if (!panel.hidden) load(false);
	}

	refresh.addEventListener("click", () => load(true));
	sameOnly.addEventListener("change", () => {
		store.set(SAME_ARTIST_KEY, sameOnly.checked);
		render();
	});
	resetBtn.addEventListener("click", () => applySpeed(1));
	slider.addEventListener("input", () => {
		speedValue.textContent = fmtSpeed(clampSpeed(slider.value));
	});
	slider.addEventListener("change", () => applySpeed(clampSpeed(slider.value)));
	Spicetify.Player.addEventListener("songchange", onSongChange);
	player().getEvents().addListener("update", onPlayerUpdate);

	button = new Spicetify.Playbar.Button("Speed & versions", ICON_BUTTON, () => (panel.hidden ? openPanel() : closePanel()));
	syncSpeedUi();

	window.__speedPitch = {
		dispose() {
			closePanel();
			Spicetify.Player.removeEventListener("songchange", onSongChange);
			player().getEvents().removeListener("update", onPlayerUpdate);
			button.deregister();
			panel.remove();
			style.remove();
			delete window.__speedPitch;
		},
	};
})();

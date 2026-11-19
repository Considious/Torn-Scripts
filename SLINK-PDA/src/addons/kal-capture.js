// KAL 1.3.3 — Kalends [2032147]. All Rights Reserved.
// Source incorporation/redistribution: user confirmation, 2026-11-19. See UPSTREAM.md.
// Generated from upstream SHA-256 24206f522a85a1b67069addde7c630c19006db6cebe00cd97cfb703bea71de48; run tools/extract-kal.mjs.
(function(global){'use strict';if(global.SLINK_KAL_CAPTURE)return;const W=global,PAGE_W=global;
	function positiveInteger(value) {
		const number = Number(value);
		return Number.isSafeInteger(number) && number > 0 ? number : null;
	}
	function objectRecord(value) {
		return value !== null && typeof value === "object" && !Array.isArray(value);
	}

	function attackDataDb(data) {
		return objectRecord(data.DB) ? data.DB : data;
	}
	function attackTargetId(data) {
		const user = attackDataDb(data).defenderUser;
		return positiveInteger(objectRecord(user) ? user.userID : null);
	}
	function attackAttackerId(data) {
		const db = attackDataDb(data);
		const user = db.attackerUser;
		const direct = positiveInteger(objectRecord(user) ? user.userID : null);
		if (direct) return direct;
		if (!Array.isArray(db.currentClips)) return null;
		for (const value of db.currentClips) {
			const id = positiveInteger((objectRecord(value) ? value : null)?.attackerID);
			if (id) return id;
		}
		return null;
	}
	function attackFightId(data) {
		const db = attackDataDb(data);
		const direct = positiveInteger(db.fightID ?? db.fightId);
		if (direct) return direct;
		if (!Array.isArray(db.currentClips)) return null;
		for (const value of db.currentClips) {
			const clip = objectRecord(value) ? value : null;
			const id = positiveInteger(clip?.fightID ?? clip?.fightId);
			if (id) return id;
		}
		return null;
	}
	function attackStatus(data) {
		const value = attackDataDb(data).attackStatus;
		return typeof value === "string" ? value : null;
	}
	var FISTS_ITEM_ID = 999;
	var COMBAT_EQUIP_SLOTS = new Set([
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9
	]);
	function hasCompleteDefenderLoadout(defenderItems) {
		if (!objectRecord(defenderItems)) return false;
		const fists = defenderItems[FISTS_ITEM_ID]?.item;
		if (Array.isArray(fists) && fists.some((item) => Number(item?.ID) === FISTS_ITEM_ID)) return true;
		return Object.values(defenderItems).some((container) => {
			const item = container?.item?.[0];
			return objectRecord(item) && COMBAT_EQUIP_SLOTS.has(Number(item.equipSlot)) && positiveInteger(item.armouryID ?? item.armoryID) !== null;
		});
	}
	function compactDefenderItems(defenderItems) {
		if (!objectRecord(defenderItems)) return {};
		const compact = {};
		for (const [key, container] of Object.entries(defenderItems)) {
			if (!objectRecord(container) || !Array.isArray(container.item)) continue;
			if (container.item.some((item) => objectRecord(item) && (Number(item.ID) === FISTS_ITEM_ID || COMBAT_EQUIP_SLOTS.has(Number(item.equipSlot))))) compact[key] = container;
		}
		return compact;
	}
	function latestCurrentClip(currentClips) {
		let clip = {};
		if (Array.isArray(currentClips)) {
			for (let index = currentClips.length - 1; index >= 0; index -= 1) if (objectRecord(currentClips[index])) {
				clip = currentClips[index];
				break;
			}
		}
		return clip;
	}
	function ammoCategory(db, clip, prefix, slot) {
		const type = objectRecord(clip[`defender${prefix}Type`]) ? clip[`defender${prefix}Type`] : {};
		if ((objectRecord(db.defenderAmmoStatus) ? db.defenderAmmoStatus[slot] : null) === "No ammo") return 0;
		if (db.showEnemyItems !== true) return null;
		return positiveInteger(type.ammoCategoryID);
	}
	function extractDefenderAmmo(db, currentClips) {
		const clip = latestCurrentClip(currentClips);
		const result = [ammoCategory(db, clip, "Primary", "1"), ammoCategory(db, clip, "Secondary", "2")];
		return result[0] === null && result[1] === null ? null : result;
	}
	function extractLogId(value) {
		if (typeof value !== "string") return null;
		const normalized = value.toLowerCase();
		return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null;
	}
	function travelState(data, db) {
		const message = [data.startErrorTitle, db.error].find((value) => typeof value === "string" && value.length)?.toLowerCase();
		if (message?.includes("currently traveling")) return "traveling";
		if (message?.includes("another country")) return "abroad";
		return null;
	}
	function buildAttackCapture(data, context) {
		const db = attackDataDb(data);
		if (!hasCompleteDefenderLoadout(db.defenderItems)) return null;
		const targetId = attackTargetId(data);
		if (!targetId || targetId !== context.expectedTargetId) return null;
		const fightId = attackFightId(data);
		const showEnemyItems = db.showEnemyItems === true;
		const defenderItems = compactDefenderItems(db.defenderItems);
		return {
			payload_source: context.payloadSource ?? "native",
			target_id: targetId,
			captured_at: context.capturedAt,
			fight_id: fightId,
			attack_status: attackStatus(data)?.slice(0, 32) ?? null,
			show_enemy_items: showEnemyItems,
			travel_state: travelState(data, db),
			defender_items: defenderItems,
			ammo: extractDefenderAmmo(db, db.currentClips),
			log_id: extractLogId(db.logID),
			master_log: positiveInteger(db.masterLog)
		};
	}

	var captureId = async (data, c) => {
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
			1,
			c.target_id,
			Date.parse(c.captured_at),
			c.fight_id || 0,
			c.payload_source || "",
			c.travel_state || "",
			c.show_enemy_items ? 1 : 0,
			c.defender_items
		])));
		const bytes = new Uint8Array(digest, 0, 16);
		const view = new DataView(bytes.buffer);
		view.setUint32(0, (view.getUint32(0) ^ (attackAttackerId(data) || 0)) >>> 0);
		return [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
	};

	function tornNow() {
		let reported;
		try {
			const clock = PAGE_W.getCurrentTimestamp;
			reported = typeof clock === "function" ? Reflect.apply(clock, PAGE_W, []) : void 0;
		} catch {
			return Date.now();
		}
		if (typeof reported === "number" && Number.isFinite(reported) && reported > 0) return reported < 0xe8d4a51000 ? reported * 1e3 : reported;
		return Date.now();
	}

	function isRewrittenResponse(response) {
		try {
			return response.url === "" || response.type === "default";
		} catch {
			return true;
		}
	}
	function isAttackDataRequest(input) {
		let rawUrl;
		try {
			if (typeof input === "string") rawUrl = input;
			else {
				const foreign = input;
				rawUrl = typeof foreign?.url === "string" ? foreign.url : foreign?.href;
			}
		} catch {
			return false;
		}
		if (typeof rawUrl !== "string" || !rawUrl.includes("sid=attackData")) return false;
		try {
			const url = new URL(rawUrl, W.location.href);
			return url.origin === W.location.origin && url.pathname === "/page.php" && url.searchParams.get("sid") === "attackData";
		} catch {
			return false;
		}
	}

global.SLINK_KAL_CAPTURE=Object.freeze({buildAttackCapture,captureId,isAttackDataRequest,isRewrittenResponse,attackTargetId,attackStatus,attackAttackerId,tornNow});
})(globalThis);

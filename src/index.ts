import {
	makeWASocket,
	useMultiFileAuthState,
	DisconnectReason,
	GroupMetadata,
} from "baileys";
import QRCode from "qrcode";
import NodeCache from "node-cache";
import { Boom } from "@hapi/boom";
import { groupActionCheck, langDetector, randomTimer } from "./helpers.js";
import dotenv from "dotenv";
import chalk from "chalk";
import pino from "pino";

dotenv.config();

const groupId = process.env.GROUP_ID;

async function startSock() {
	const { saveCreds, state } = await useMultiFileAuthState("./auth_info");
	const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

	const sock = makeWASocket({
		auth: state,
		cachedGroupMetadata: async (jid) => groupCache.get(jid),
		// Set to "info" for detailed logs, or "silent" for clean output
		logger: pino({ level: "silent" }),
	});

	sock.ev.on("creds.update", saveCreds);

	sock.ev.on("connection.update", async (update) => {
		const { connection, lastDisconnect, qr } = update;
		if (qr) {
			console.log(chalk.greenBright("\nScan this QR code to login:\n"));
			console.log(await QRCode.toString(qr, { type: "terminal", small: true }));
		}
		if (connection) {
			console.log(chalk.blueBright(`[WA] Connection status: ${connection}`));
		}
		if (connection === "open") {
			// Start polling every 5 seconds
			pollGroupParticipants(sock, groupId as string);
		}	
		if (connection === "close") {
			const shouldReconnect =
				(lastDisconnect?.error as Boom).output.statusCode !==
				DisconnectReason.loggedOut;
			console.log(
				chalk.yellow(`[WA] Connection closed. Reconnecting: ${shouldReconnect}`)
			);
			if (shouldReconnect) {
				startSock();
			} else {
				console.log(chalk.red("[WA] Logged out. Please re-authenticate."));
			}
		}
	});
	sock.ev.on("group-participants.update", async (request) => {
		const { action, id, participants } = request;

		const metadata = await sock.groupMetadata(id);
		groupCache.set(id, metadata);

		// Messaging for join/leave events
		if (id === groupId) {
			for (const participant of participants) {
				if (action === "add") {
					// User joined (via add)
					setTimeout(async () => {
						await sock.sendMessage(participant, {
							text: "Hey! I saw your request to join the group. Could you please share a brief introduction about yourself?"
						});
						console.log(chalk.green(`[JoinRequest] Sent intro message to ${participant}`));
					}, randomTimer());
				} else if (action === "remove") {
					// User left (via remove)
					setTimeout(async () => {
						await sock.sendMessage(participant, {
							text: "Hey I noticed you left the group Just wanted to check if there's any feedback you’d like to share"
						});
						console.log(chalk.green(`[Leave] Sent feedback message to ${participant}`));
					}, randomTimer());
				}
			}
		}
	});

	sock.ev.on("messages.upsert", async ({ messages }) => {
		const msg = messages[0];
		if (!msg.message || msg.key.fromMe) return;

		const remoteJid = msg.key.remoteJid!;
		const senderId = msg.key.participant || msg.key.remoteJid!;
		const isGroup = remoteJid === groupId;

		if (isGroup) {
			const text =
				msg.message?.conversation ||
				msg.message?.extendedTextMessage?.text ||
				"";

			if (!text) return;

			// 1. Console log the message
			console.log(
				chalk.cyan(`[Message] From ${senderId.split("@")[0]}: ${text}`)
			);

			const language = await langDetector(text);

			// 2. Log if it is not in English or not
			if (language !== "en") {
				console.log(
					chalk.yellow(
						`[Language Check] Detected language: ${language}. NOT ENGLISH.`
					)
				);

				// 3. Send a message
				setTimeout(async () => {
					console.log(
						chalk.red(`--> Sending warning to ${senderId.split("@")[0]}`)
					);
					await sock.sendMessage(groupId, {
						text: `@${
							senderId.split("@")[0]
						}, As part of the requirement of the group, you are required to speak english only`,
						mentions: [senderId],
					});
				}, randomTimer());
			} else {
				console.log(
					chalk.green(
						`[Language Check] Detected language: ${language}. IS ENGLISH.`
					)
				);
			}
		}
	});
}

// Add this function inside or outside startSock as needed
async function pollGroupParticipants(
	sock: ReturnType<typeof makeWASocket>,
	groupId: string
	) {
		// Track join requests and their status
		type JoinRequestInfo = {
			parent_group_jid: string;
			jid: string;
			request_method: string;
			request_time: string;
			phone_number: string;
			messageSent: boolean;
			status: "pending" | "approved" | "rejected";
		};
		const joinRequestCache = new NodeCache({ stdTTL: 60 * 60 * 48, checkperiod: 60 }); // 48 hours TTL
		const configuredExpiryMs = Number(process.env.JOIN_REQUEST_TIMEOUT_MS);
		const joinRequestExpiryMs = Number.isFinite(configuredExpiryMs) && configuredExpiryMs > 0
			? configuredExpiryMs
			: 48 * 60 * 60 * 1000;
		console.log(
			chalk.yellow(
				`[JoinRequest] Auto-reject timeout set to ${(joinRequestExpiryMs / (60 * 60 * 1000)).toFixed(2)} hours`
			)
		);

		// Only keep messaging functionality for join requests

		while (true) {
			try {
				const response = await sock.groupRequestParticipantsList(groupId);
				console.log(chalk.yellowBright(`[Poll] groupRequestParticipantsList output:`));
				console.log(chalk.yellowBright(JSON.stringify(response, null, 2)));

				if (Array.isArray(response)) {
					for (const req of response) {
						// Use request jid as unique key
						const cacheKey = req.jid;
						const cached = joinRequestCache.get(cacheKey) as JoinRequestInfo | undefined;
						if (!cached) {
							// Send personal message only once
							try {
								await sock.sendMessage(req.phone_number, {
									text: "Hey! I saw your request to join the group. Could you please share a brief introduction about yourself?"
								});
								console.log(chalk.green(`[JoinRequest] Sent intro message to ${req.phone_number}`));
							} catch (err) {
								console.error(chalk.red(`[JoinRequest] Failed to send intro message to ${req.phone_number}:`), err);
							}
							// Store in cache
							joinRequestCache.set(cacheKey, {
								parent_group_jid: req.parent_group_jid,
								jid: req.jid,
								request_method: req.request_method,
								request_time: req.request_time,
								phone_number: req.phone_number,
								messageSent: true,
								status: "pending"
							});
						}
					}
				}
			} catch (err) {
				console.error(chalk.red("[Poll] Failed to fetch group participants list:"), err);
			}
			await new Promise((res) => setTimeout(res, 5000)); // wait 5 seconds
		}
	}

startSock();

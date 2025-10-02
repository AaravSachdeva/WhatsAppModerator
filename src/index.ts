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

dotenv.config();

const groupId = process.env.GROUP_ID;

async function startSock() {
	const { saveCreds, state } = await useMultiFileAuthState("./auth_info");
	const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

	const sock = makeWASocket({
		auth: state,
		// markOnlineOnConnect: true,
		cachedGroupMetadata: async (jid) => groupCache.get(jid),
		// printQRInTerminal: true,

		syncFullHistory: false,
		shouldSyncHistoryMessage: () => false,
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

		if (id === groupId) {
			for (const participant of participants) {
				const message = groupActionCheck(action, participant);
				setTimeout(async () => {
					console.log(chalk.magenta(`[Group] ${action} - ${participant}`));
					await sock.sendMessage(groupId, {
						text: message,
						mentions: [participant],
					});
				}, randomTimer());
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

			console.log(chalk.cyan(`[Message] ${senderId}: ${text}`));

			const language = await langDetector(text);

			if (language !== "en") {
				setTimeout(async () => {
					console.log(
						chalk.red(`[Language] Non-English detected from ${senderId}`)
					);
					await sock.sendMessage(groupId, {
						text: `@${
							senderId.split("@")[0]
						}, As part of the requirement of the group, you are required to speak english only`,
						mentions: [senderId],
					});
				}, randomTimer());
			}
		}
	});
}

startSock();

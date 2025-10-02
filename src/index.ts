import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, GroupMetadata } from 'baileys';
import QRCode from 'qrcode'
import NodeCache from 'node-cache'
import { Boom } from '@hapi/boom'
import { groupActionCheck, langDetector, randomTimer } from './helpers.js';
import dotenv from 'dotenv';
dotenv.config();

const groupId = process.env.GROUP_ID;



async function startSock() {

    const { saveCreds, state } = await useMultiFileAuthState('./auth_info');
    const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

    const sock = makeWASocket({
        auth: state,
        // markOnlineOnConnect: true,
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
        printQRInTerminal: true,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            // as an example, this prints the qr code to the terminal
            console.log(await QRCode.toString(qr, { type: 'terminal', small: true}))
        }
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom).output.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startSock()
            }
        }
    })
    sock.ev.on("group-participants.update", async (request) => {
        const { action, id, participants } = request;

        const metadata = await sock.groupMetadata(id);
        groupCache.set(id, metadata);

        if (id === groupId) {
            for (const participant of participants) {
                const message = groupActionCheck(action, participant);
                setTimeout(async () => {
                    await sock.sendMessage(groupId, {
                        text: message,
                        mentions: [participant]
                    });
                }, randomTimer())
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {

        const msg = messages[0];
        const isGroup = msg.key.remoteJid === groupId;
        if (isGroup) {
            if (!msg.message || msg.key.fromMe) return;
            const groupId = msg.key.remoteJid!;
            const senderId = msg.key.participant!;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            const language = await langDetector(text);

            if (language !== "en") {
                setTimeout(async () => {
                    await sock.sendMessage(groupId, { text: `@${senderId.split('@')[0]}, As part of the requirement of the group, you are required to speak english only`, mentions: [senderId] });
                }, randomTimer())

            }
        }
    });
}

startSock();


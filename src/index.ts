// index.ts or auth.ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, GroupMetadata } from 'baileys';
import QRCode from 'qrcode'
// import P from 'pino'
import { Boom } from '@hapi/boom'

const groupId = "120363420386820501@g.us";

const groupActionCheck = (action: string, participant: string) => {
    if (action === "add") {
        return `hello ${participant}`
    }
    else if (action === "remove") {
        return `${participant} has been ${action}d`
    }
    else if (action === "promote") {
        return `${participant} has been ${action}d`
    }
    else if (action === "demote") {
        return `${participant} has been ${action}d`
    }
    return ""
}

async function startSock() {

    const { saveCreds, state } = await useMultiFileAuthState('./auth_info');


    const sock = makeWASocket({
        auth: state,
        // markOnlineOnConnect: true,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            // as an example, this prints the qr code to the terminal
            console.log(await QRCode.toString(qr, { type: 'terminal' }))
        }
        if (connection === "close") {
            const shouldReconnect = (lastDisconnect?.error as Boom).output.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startSock()
            }
        }
    })
    sock.ev.on("group-participants.update", async (request) => {
        const { action, author, id, participants } = request;

        if (id === groupId) {
            participants.forEach(async (participant) => {
                await sock.sendMessage(
                    groupId,
                    {
                        text: groupActionCheck(action, participant),
                        // mentions: ['12345678901@s.whatsapp.net']
                    }
                )
            })

        }

    })

}

startSock();

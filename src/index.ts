// index.ts or auth.ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from 'baileys';
import QRCode from 'qrcode'
// import P from 'pino'
import { Boom } from '@hapi/boom'

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

}

startSock();

// index.ts or auth.ts
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from 'baileys';
import QRCode from 'qrcode'

const getCreds = async () => {
    const { saveCreds, state } = await useMultiFileAuthState('./auth_info');
    return { saveCreds, state }
}

async function startSock() {

    const { saveCreds, state } = await getCreds();


    const sock = makeWASocket({
        auth: state,
        browser: Browsers.macOS("Google Chrome"),
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            // as an example, this prints the qr code to the terminal
            console.log(await QRCode.toString(qr, { type: 'terminal' }))
        }
    })
}

startSock();

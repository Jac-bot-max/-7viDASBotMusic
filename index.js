const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

const port = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send(`
        <html>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#00ff00;">JACKSON BEATZ V3</h1>
                <p>Mantenha esta página aberta!</p>
                <input type="number" id="num" placeholder="258xxxxxxxx" style="padding:15px; border-radius:10px; width:280px; font-size:18px;">
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px;">FORÇAR NOTIFICAÇÃO</button>
                <h1 id="res" style="color:#ffff00; font-size:50px; margin-top:30px;"></h1>
                <p id="st" style="color:#888;"></p>
                <script>
                    function gerar() {
                        const n = document.getElementById('num').value;
                        if(!n) return alert('Digite o número!');
                        document.getElementById('st').innerText = 'Solicitando ao WhatsApp...';
                        fetch('/pairing?nh=' + n).then(r => r.json()).then(d => {
                            document.getElementById('res').innerText = d.code || 'Erro';
                            document.getElementById('st').innerText = 'CÓDIGO GERADO! Se a notificação não aparecer, faça o passo manual abaixo.';
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // MUDANÇA: Identidade de Windows (A que mais dispara notificação)
        browser: ["Windows", "Chrome", "110.0.5481.178"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            await delay(3000); // Espera 3 segundos para estabilizar
            let code = await sock.requestPairingCode(nh);
            res.json({ code: code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        const { connection } = u;
        if (connection === "close") startBot();
        if (connection === "open") {
            console.log("\n////////////////////////////////////////////////////\n");
            console.log("✅ BOT JACKSON BEATZ ONLINE!");
            console.log("\n////////////////////////////////////////////////////\n");
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log(sessionStr); // A KEY QUE VOCÊ QUER
            console.log("\n////////////////////////////////////////////////////\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        if (m.message.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! V3 Online!" });
        }
    });
}

app.listen(port);
startBot();

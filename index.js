const { default: makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();

// INTERFACE WEB - TRAVADA PARA MOÇAMBIQUE
app.get("/", (req, res) => {
    res.send(`
        <html>
            <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="background:#000; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h1 style="color:#00ff00;">JACKSON BEATZ V3</h1>
                <p>O código será enviado para o WhatsApp de Moçambique.</p>
                
                <div style="background:#222; padding:20px; display:inline-block; border-radius:10px;">
                    <span style="font-size:20px; font-weight:bold;">+258</span>
                    <input type="number" id="num" placeholder="84... / 82... / 87..." style="padding:10px; border-radius:5px; border:none; font-size:18px; width:180px;">
                </div>
                <br><br>
                <button onclick="gerar()" style="padding:15px 30px; background:#00ff00; font-weight:bold; cursor:pointer; border-radius:10px; border:none;">RECEBER NOTIFICAÇÃO</button>
                
                <h1 id="res" style="color:#ffff00; font-size:50px; margin-top:30px; letter-spacing:5px;"></h1>
                <p id="st" style="color:#888;"></p>

                <script>
                    function gerar() {
                        let n = document.getElementById('num').value;
                        if(n.length < 8) return alert('Número muito curto!');
                        
                        // Garante que o número comece com 258 para o WhatsApp reconhecer
                        let fullNumber = "258" + n.replace(/^258/, '');
                        
                        document.getElementById('st').innerText = 'Solicitando notificação para ' + fullNumber + '...';
                        fetch('/pairing?nh=' + fullNumber).then(r => r.json()).then(d => {
                            if(d.code) {
                                document.getElementById('res').innerText = d.code;
                                document.getElementById('st').innerText = 'NOTIFICAÇÃO ENVIADA! Veja o topo do seu celular.';
                            } else {
                                document.getElementById('st').innerText = 'Erro! Tente novamente em 1 minuto.';
                            }
                        });
                    }
                </script>
            </body>
        </html>
    `);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');

    // BLINDAGEM: Se tiver a SESSION_DATA no Render, ele ignora o login
    if (process.env.SESSION_DATA && !state.creds.registered) {
        try {
            state.creds = JSON.parse(Buffer.from(process.env.SESSION_DATA, 'base64').toString());
        } catch (e) { console.log("Erro na SESSION_DATA"); }
    }

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        // O NOME DO DISPOSITIVO QUE APARECE NA NOTIFICAÇÃO
        browser: ["Jackson Beatz", "Chrome", "1.0.0"],
        printQRInTerminal: false,
        syncFullHistory: false
    });

    app.get("/pairing", async (req, res) => {
        let nh = req.query.nh;
        try {
            await delay(2000); // Espera estabilizar
            let code = await sock.requestPairingCode(nh);
            res.json({ code });
        } catch (e) { res.json({ error: true }); }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (u) => {
        if (u.connection === "close") startBot();
        if (u.connection === "open") {
            console.log("\n🚀 CONECTADO COM SUCESSO!");
            const sessionStr = Buffer.from(JSON.stringify(sock.authState.creds)).toString('base64');
            console.log("\n--- COPIE O BLOCO ABAIXO ---");
            console.log(sessionStr);
            console.log("----------------------------\n");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (m.message?.conversation === "!ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "🏓 Pong! Bot Moçambique ativo." });
        }
    });
}

app.listen(process.env.PORT || 10000);
startBot();

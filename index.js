const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require("fs");
const http = require("http");

// Servidor para o Render não derrubar o bot
http.createServer((req, res) => res.end('Jackson AI Online')).listen(process.env.PORT || 3000);

async function startBot() {
    // --- FUNÇÃO PARA RESTAURAR A KEY (SESSÃO) ---
    // Se você colar a KEY no Render, ele cria o arquivo sozinho
    if (process.env.SESSION_ID && !fs.existsSync('session/creds.json')) {
        console.log("Restaurando conexão através da KEY...");
        if (!fs.existsSync('session')) fs.mkdirSync('session');
        fs.writeFileSync('session/creds.json', Buffer.from(process.env.SESSION_ID, 'base64').toString('utf-8'));
    }

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- LÓGICA DO PAIRING CODE ---
    if (!conn.authState.creds.registered) {
        const phoneNumber = "258865560063"; 
        await delay(8000);
        try {
            let code = await conn.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`\n====================================\n`);
            console.log(`SEU CÓDIGO DE CONEXÃO: ${code}`);
            console.log(`\n====================================\n`);
        } catch (error) {
            console.error("Erro ao gerar código:", error);
        }
    }

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log("✅ BOT CONECTADO COM SUCESSO!");
            
            // --- GERADOR DE KEY (SESSÃO) ---
            // Quando conectar, ele vai te dar a KEY no log para você salvar no Render
            const creds = fs.readFileSync('session/creds.json');
            const sessionKey = Buffer.from(creds).toString('base64');
            console.log(`\n=== SUA KEY DE SESSÃO (COPIE ISSO) ===\n\n${sessionKey}\n\n======================================\n`);
        }
        if (connection === 'close') {
            console.log("❌ Conexão fechada, tentando reiniciar...");
            startBot();
        }
    });

    // --- COMANDOS E MODERAÇÃO ---
    conn.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const isGroup = from.endsWith('@g.us');
        const prefix = ".";

        // 🎵 REAÇÃO A ÁUDIO
        if (type === 'audioMessage') {
            await conn.sendMessage(from, { text: 'Obrigado por compartilhar esta obra, um dos nossos vai analisar. 🎵', quoted: msg });
        }

        if (!body.startsWith(prefix)) return;
        const command = body.slice(1).trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        // Lógica de Adm (Verificação rápida)
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : null;
        const groupAdmins = isGroup ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
        const isSenderAdmin = groupAdmins.includes(msg.key.participant);

        switch (command) {
            case 'menu':
                const menu = `┌──────────────────────────┐
│      JACKSON AI 🎵       │
│                          │
│  .infogrupo              │
│  .infoadm                │
│  .marcar (texto)         │
│  .ban (@membro)          │
│  .del (responda msg)     │
│                          │
└──────────────────────────┘`;
                await conn.sendMessage(from, { text: menu });
                break;

            case 'ban':
                if (!isGroup || !isSenderAdmin) return;
                const victim = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (!victim) return;
                await conn.groupParticipantsUpdate(from, [victim], 'remove');
                break;

            case 'marcar':
                if (!isGroup || !isSenderAdmin) return;
                let texto = `📢 *AVISO GERAL*\n\n${args.join(" ") || "Olá família, precisamos de mais membros! Compartilhem o grupo!"}\n\n`;
                for (let p of groupMetadata.participants) { texto += `@${p.id.split('@')[0]} `; }
                await conn.sendMessage(from, { text: texto, mentions: groupMetadata.participants.map(a => a.id) });
                break;
            
            case 'infogrupo':
                if (!isGroup) return;
                await conn.sendMessage(from, { text: `🏠 *Grupo:* ${groupMetadata.subject}\n👥 *Membros:* ${groupMetadata.participants.length}` });
                break;
        }
    });
}

startBot().catch(err => console.log("Erro ao iniciar:", err));
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const mongoose = require("mongoose");
const pino = require("pino");
const http = require("http");

// --- CONFIGURAÇÃO ---
const mongoURL = process.env.MONGODB_URL; 
const phoneNumber = "258865560063"; 
const prefix = "."; 

// Servidor para o Render não derrubar o bot
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.end('Jackson AI Online e Operacional!');
}).listen(port);

async function startBot() {
    try {
        await mongoose.connect(mongoURL);
        console.log("✅ BANCO DE DADOS: CONECTADO!");

        const { state, saveCreds } = await useMultiFileAuthState('session');
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ["Jackson AI", "Chrome", "1.0.0"]
        });

        // --- MONITOR DE MENSAGENS (O CÉREBRO) ---
        conn.ev.on('messages.upsert', async m => {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : (type === 'imageMessage' || type === 'videoMessage') ? msg.message[type].caption : '';
            
            // 🎵 REAÇÃO A ÁUDIO
            if (type === 'audioMessage') {
                return conn.sendMessage(from, { text: "Obrigado por compartilhar esta obra, um dos nossos vai analisar. 🎵", quoted: msg });
            }

            if (!body.startsWith(prefix)) return;

            const command = body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();
            const args = body.trim().split(/ +/).slice(1);

            // Lógica de Adm
            const groupMetadata = from.endsWith('@g.us') ? await conn.groupMetadata(from) : null;
            const groupAdmins = groupMetadata ? groupMetadata.participants.filter(v => v.admin !== null).map(v => v.id) : [];
            const isSenderAdmin = groupAdmins.includes(msg.key.participant);
            const isBotAdmin = groupAdmins.includes(conn.user.id.split(':')[0] + '@s.whatsapp.net');

            switch (command) {
                case 'menu':
                    const menuTexto = `
┌──────────────────────────┐
│      JACKSON AI 🎵       │
│                          │
│  .infogrupo (Info atual) │
│  .infoadm (Lista Adms)   │
│  .marcar (Aviso Geral)   │
│  .ban (Remover membro)   │
│  .del (Apagar msg)       │
│                          │
│  Status: 🟢 24h Ativo    │
└──────────────────────────┘`;
                    await conn.sendMessage(from, { text: menuTexto });
                    break;

                case 'infogrupo':
                    if (!groupMetadata) return;
                    conn.sendMessage(from, { text: `🏠 *GRUPO:* ${groupMetadata.subject}\n👥 *MEMBROS:* ${groupMetadata.participants.length}` });
                    break;

                case 'infoadm':
                    if (!groupMetadata) return;
                    let list = "👮‍♂️ *ADMINS DO GRUPO:*\n\n";
                    groupAdmins.forEach(id => list += `• @${id.split('@')[0]}\n`);
                    conn.sendMessage(from, { text: list, mentions: groupAdmins });
                    break;

                case 'marcar':
                    if (!isSenderAdmin) return;
                    let texto = `📢 *AVISO GERAL*\n\n${args.join(" ") || "Olá família, precisamos de mais membros! Compartilhem o grupo!"}\n\n`;
                    groupMetadata.participants.forEach(p => texto += `@${p.id.split('@')[0]} `);
                    conn.sendMessage(from, { text: texto, mentions: groupMetadata.participants.map(p => p.id) });
                    break;

                case 'ban':
                    if (!isSenderAdmin || !isBotAdmin) return;
                    const victim = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                    if (!victim) return conn.sendMessage(from, { text: "Marque quem deseja banir." });
                    await conn.groupParticipantsUpdate(from, [victim], 'remove');
                    conn.sendMessage(from, { text: "👢 Usuário removido." });
                    break;
            }
        });

        // Evento de conexão
        conn.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') console.log("✅ WHATSAPP: CONECTADO!");
            if (connection === 'close') setTimeout(startBot, 5000);
        });

        conn.ev.on('creds.update', saveCreds);

        // Pedir código se deslogar
        if (!conn.authState.creds.registered) {
            await delay(10000);
            const code = await conn.requestPairingCode(phoneNumber);
            console.log(`\n====================================\nCODIGO: ${code}\n====================================\n`);
        }

    } catch (err) {
        console.log("❌ ERRO:", err.message);
    }
}

startBot();
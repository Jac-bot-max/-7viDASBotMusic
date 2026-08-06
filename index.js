import express from 'express';
import makeWASocket, { delay, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from "@whiskeysockets/baileys";
import pino from "pino";
import yts from "yt-search";
import fs from "fs";

// =============================================================================
// REGIÃO 1: ESTABILIDADE RENDER (PORTA 10000)
// =============================================================================
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Ativo para TODOS! 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.advertencias) global.advertencias = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    // Recuperar login via KEY
    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
    }

    const socket = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['7viDASBotMusic PRO', 'Safari', '3.0'],
        shouldSyncHistoryMessage: () => false
    });

    socket.ev.on("creds.update", saveCreds);

    // =========================================================================
    // REGIÃO 2: BOAS-VINDAS GERAL (COM FOTO E FRASE NOVA)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *WELCOME* ✨ ═══════╗\n║ 👋 Olá @${jid.split('@')[0]}!\n║ Que bom que vocês estão aqui para\n║ aprender mais sobre produção musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => { if (u.connection === "close") startBot(); });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 3: XERIFE MÃO DE FERRO (DETETAR STATUS E LINKS DE TODOS)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                const isStatus = type === 'protocolMessage' || msg.message?.statusMentionMessage || textLow.includes("status de") || textLow.includes("@ este grupo foi mencionado");
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                if ((isStatus || isLink) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Conteúdo proibido removido. Aqui só Beat e Produção! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 4: CÉREBRO DE MÍDIA (VOZ VS BEAT/VÍDEO) - PARA TODOS
            // =====================================================================
            if (type === 'audioMessage' || type === 'videoMessage') {
                if (msg.message?.audioMessage?.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // REGIÃO 5: AUTO-RESPONDER SOCIAL (PARA TODOS OS MEMBROS)
            // =====================================================================
            const saudações = ["oi", "olá", "ola", "kmk família", "kmk beatmakers", "bom dia", "boa noite"];
            if (saudações.includes(textLow)) {
                const r = `✨ *[@7viDASBotMusic]* ✨\n\n🔵 Olá @${sender.split('@')[0]}! Que bom que estás aqui para aprender sobre produção musical! Como está o trabalho? 🇲🇿🇦🇴`;
                await socket.sendMessage(from, { text: r, mentions: [sender] }, { quoted: msg });
                return;
            }

            // =====================================================================
            // REGIÃO 6: COMANDOS MANUAIS ESPECÍFICOS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) return;
            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            switch (command) {
                case "menu":
                    const menu = `╔═══════ 🔵 *@7viDASBotMusic* 🔵 ═══════╗
║
║ 🔴 *ＡＤＭＩＮＩＳＴＲＡＣ̧ＡＯ*
║ ◽ .marcar - Promover o grupo
║ ◽ .link - Link oficial
║ ◽ .ban - Remover (marque user)
║ ◽ .promote | .demote
║
║ ⚪ *ＰＲＯＤＵＣ̧ＡＯ*
║ ◽ .play | .yt | .drums | .vst
║ ◽ .apps | .dicas | .foto
║
║ 🔵 *ＳＩＳＴＥＭＡ*
║ ◽ .ping | .infoadm | .key
║
║ 👑 ADMIN: JACKSON@7VIDAS
║ 🇲🇿 Moçambique & Angola 🇦🇴
╚══════════════════════════════╝`;
                    await socket.sendMessage(from, { text: menu });
                    break;

                case "marcar":
                    const g = await socket.groupMetadata(from);
                    const promoText = `📢 🔴 *ＡＴＥＮＣ̧Ａ̃Ｏ ＭＥＭＢＲＯＳ* 🔴\n\n🚀 Vamos promover o grupo para que tenhamos mais produtores ativos! Atualmente o nosso número de membros é menor do que o necessário. Vamos crescer juntos! 🇲🇿🇦🇴\n\n🔗 *PARTILHEM O LINK:* https://chat.whatsapp.com/${await socket.groupInviteCode(from)}`;
                    await socket.sendMessage(from, { text: promoText, mentions: g.participants.map(p => p.id) });
                    break;

                case "link":
                    const code = await socket.groupInviteCode(from);
                    await socket.sendMessage(from, { text: `🔗 *LINK OFICIAL:* https://chat.whatsapp.com/${code}` });
                    break;

                case "ban":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "remove");
                    break;
                
                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor, Compositor & Produtor\n💻 Programador & Estudante\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;
                
                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* Estável\n🤖 *BOT:* @7viDASBotMusic Online` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
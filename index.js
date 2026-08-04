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
app.get('/', (req, res) => res.send('@7viDASBotMusic PRO - Admin Mode Ativo 🇲🇿🇦🇴'));
app.listen(port, '0.0.0.0', () => console.log(`✅ Servidor ativo na porta ${port}`));

if (!global.warns) global.warns = new Map();

async function startBot() {
    // =========================================================================
    // REGIÃO 2: RECUPERAÇÃO DE SESSÃO (SESSION_ID)
    // =========================================================================
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const sessionID = process.env.SESSION_ID;

    if (sessionID && !fs.existsSync('./session_data/creds.json')) {
        const decoded = Buffer.from(sessionID, 'base64').toString('utf-8');
        if (!fs.existsSync('./session_data')) fs.mkdirSync('./session_data');
        fs.writeFileSync('./session_data/creds.json', decoded);
        console.log("📂 Sessão restaurada com sucesso!");
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
    // REGIÃO 3: BOAS-VINDAS PROFISSIONAL (COM FOTO)
    // =========================================================================
    socket.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let jid of anu.participants) {
                try {
                    let pp; try { pp = await socket.profilePictureUrl(jid, 'image'); } catch { pp = 'https://i.imgur.com/6V69j9X.png'; }
                    const welcome = `╔═══════ ✨ *BEM-VINDO* ✨ ═══════╗\n║ 👋 Olá, @${jid.split('@')[0]}!\n║ Bem-vindo à união musical!\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n║\n║ 👑 ADMIN: *JACKSON@7VIDAS*\n║ 🔵 Digite *.menu* para navegar.\n║ 🔴 Proibido Links/Status/Insultos!\n╚══════════════════════════════╝`;
                    await socket.sendMessage(anu.id, { image: { url: pp }, caption: welcome, mentions: [jid] });
                } catch (e) {}
            }
        }
    });

    socket.ev.on("connection.update", (u) => {
        if (u.connection === "close") {
            if (u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
        } else if (u.connection === "open") console.log("✅ @7viDASBotMusic: TUDO PRONTO!");
    });

    socket.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const sender = msg.key.participant || msg.key.remoteJid;
            const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
            const textLow = textRaw.toLowerCase();

            // =====================================================================
            // REGIÃO 4: XERIFE MÃO DE FERRO (DETECTA TUDO E APAGA)
            // =====================================================================
            if (isGroup) {
                const groupMetadata = await socket.groupMetadata(from);
                const admins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);
                const isBotAdmin = admins.includes(socket.user.id.split(':')[0] + '@s.whatsapp.net');
                const isSenderAdmin = admins.includes(sender);

                // DETECTOR DE STATUS, LINKS E LIXO
                const isStatus = type === 'protocolMessage' || 
                                 msg.message?.statusMentionMessage || 
                                 textLow.includes("estado de") || 
                                 textLow.includes("status de") || 
                                 textLow.includes("@ este grupo foi mencionado");
                                 
                const isLink = /(https?:\/\/|chat\.whatsapp\.com|www\.)/gi.test(textRaw);

                if ((isStatus || isLink) && isBotAdmin && !isSenderAdmin) {
                    await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                    await delay(300);
                    await socket.sendMessage(from, { delete: msg.key }); // APAGA NA HORA
                    await socket.sendMessage(from, { text: `🔴 *SEGURANÇA:* Conteúdo proibido removido. Mantenha o grupo limpo! 🇲🇿🇦🇴` });
                    return;
                }
            }

            // =====================================================================
            // REGIÃO 5: CÉREBRO DE MÍDIA (VOZ VS BEAT/VÍDEO)
            // =====================================================================
            if (type === 'audioMessage' || type === 'videoMessage') {
                if (msg.message?.audioMessage?.ptt) {
                    await socket.sendMessage(from, { react: { text: "🎙️", key: msg.key } });
                } else {
                    await socket.sendMessage(from, { react: { text: "✅", key: msg.key } });
                    if (isGroup) await socket.sendMessage(from, { text: "⚪ *[@7viDASBotMusic]* ⚪\n\n🔵 _Positivo, aguarde. Um dos seus amigos (beatmakers) vai analisar esta obra._" }, { quoted: msg });
                }
                return;
            }

            // =====================================================================
            // REGIÃO 6: COMANDOS MANUAIS ESPECÍFICOS (.)
            // =====================================================================
            if (!textRaw.startsWith('.')) {
                // Auto-Responder Social para todos
                const saudações = ["oi", "olá", "ola", "kmk família", "kmk beatmakers", "bom dia"];
                if (saudações.includes(textLow)) {
                    await socket.sendMessage(from, { text: `🔵 Olá @${sender.split('@')[0]}! Como está a produção hoje? 🇲🇿🇦🇴`, mentions: [sender] }, { quoted: msg });
                }
                return;
            }

            const args = textRaw.slice(1).trim().split(/\s+/);
            const command = args.shift().toLowerCase();
            const query = args.join(" ");
            const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;

            switch (command) {
                case "menu":
                    const menu = `╔══════ 🔵 *@7viDASBotMusic* 🔵 ══════╗\n║\n║ 🔴 *ADMINISTRAÇÃO*\n║ ◽ .marcar | .link | .ban\n║ ◽ .promote | .demote | .infoadm\n║\n║ ⚪ *PRODUÇÃO & BUSCAS*\n║ ◽ .play [musica] | .yt [busca]\n║ ◽ .foto [nome] | .drums [estilo]\n║\n║ 🔵 *SISTEMA*\n║ ◽ .ping | .key\n║\n║ 👑 ADMIN: JACKSON@7VIDAS\n║ 🇲🇿 Moçambique & Angola 🇦🇴\n╚══════════════════════════════════╝`;
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
                    if (target) {
                        await socket.groupParticipantsUpdate(from, [target], "remove");
                        await socket.sendMessage(from, { text: "🔴 *Ação concluída:* Usuário removido." });
                    }
                    break;

                case "promote":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "promote");
                    break;

                case "demote":
                    if (target) await socket.groupParticipantsUpdate(from, [target], "demote");
                    break;

                case "ping":
                    await socket.sendMessage(from, { text: `🛰️ *LATÊNCIA:* ${Date.now() - (msg.messageTimestamp * 1000)}ms` });
                    break;

                case "infoadm":
                    await socket.sendMessage(from, { text: `👑 *JACKSON@7VIDAS*\n🎵 Cantor, Compositor & Produtor\n💻 Programador & Agente\n📞 +258 87 733 8300\n🇲🇿 MZ & AO 🇦🇴` });
                    break;

                case "yt": case "play": case "drums":
                    await socket.sendMessage(from, { text: "🔍 _Procurando, aguarde..._" });
                    const s = await yts(query || "jackson beatz");
                    if (s.videos[0]) await socket.sendMessage(from, { text: `📺 *RESULTADO*\n📌 *Título:* ${s.videos[0].title}\n🔗 *Link:* ${s.videos[0].url}` });
                    break;
            }
        } catch (e) { console.log(e); }
    });
}
startBot();
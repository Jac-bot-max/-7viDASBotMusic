// --- COLOQUE ESTAS LINHAS JUNTO ÀS IMPORTAÇÕES NO TOPO DO FICHEIRO INDEX.JS (SE JÁ NÃO EXISTIREM) ---
const yts = require('yt-search');
if (!global.advertencias) global.advertencias = new Map();
if (!global.respondidos) global.respondidos = new Set();

// --- CAIXA DE REGRAS DO GRUPO ---
const REGRAS_GRUPO = `📜 *REGRAS DO GRUPO (PRODUÇÃO MUSICAL)* 📜\n\n` +
                     `1️⃣ Proibido o envio de QUALQUER tipo de link não autorizado.\n` +
                     `2️⃣ Proibido fotos fora do tema do grupo (Apenas Beats/Música).\n` +
                     `3️⃣ Proibido áudios e gravações aleatórias sem relação com Beats.\n` +
                     `4️⃣ Respeite todos os produtores e artistas no grupo.\n\n` +
                     `⚠️ *O desrespeito destas regras resulta em BAN após 3 avisos!*`;

// --- EVENTO DE BOAS-VINDAS AUTOMÁTICO ---
socket.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    if (action === 'add') {
        for (const num of participants) {
            try {
                let fotoPerfil;
                try { fotoPerfil = await socket.profilePictureUrl(num, 'image'); } catch { fotoPerfil = 'https://flaticon.com'; }
                const ticketNumero = Math.floor(1000 + Math.random() * 9000);
                const textoBoasVindas = `👋 *BEM-VINDO(A) AO GRUPO DE PRODUTORES!*\n\n🎧 *Membro:* @${num.split('@')[0]}\n🎟️ *Ticket de Acesso:* #${ticketNumero}\n\n${REGRAS_GRUPO}`;
                await socket.sendMessage(id, { image: { url: fotoPerfil }, caption: textoBoasVindas, mentions: [num] });
            } catch (e) { console.error("Erro boas-vindas:", e); }
        }
    }
});

// --- EVENTO PRINCIPAL DE MENSAGENS CORRIGIDO ---
socket.ev.on("messages.upsert", async (chatUpdate) => {
    try {
        const msg = chatUpdate.messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) return;

        const textRaw = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
        const textoMinusculo = textRaw.toLowerCase();
        const sender = msg.key.participant || msg.key.remoteJid;

        // Administração do grupo
        const groupMetadata = await socket.groupMetadata(from);
        const admins = groupMetadata.participants.filter(p => p.admin !== null).map(p => p.id);
        const botJid = socket.user.id.includes(':') ? socket.user.id.split(':')[0] + '@s.whatsapp.net' : socket.user.id;
        const isBotAdmin = admins.includes(botJid);
        const isSenderAdmin = admins.includes(sender);

        // Moderação Automática de Links e Mídias
        if (isBotAdmin && !isSenderAdmin) {
            const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
            const isFoto = !!msg.message.imageMessage;
            const isAudioOuGravacao = !!msg.message.audioMessage;

            let infracao = false;
            let motivo = "";

            if (linkRegex.test(textoMinusculo)) {
                infracao = true;
                motivo = "envio de links não autorizados";
            } else if (isFoto && !textoMinusculo.includes('beat') && !textoMinusculo.includes('vst') && !textoMinusculo.includes('musica') && !textoMinusculo.includes('produção')) {
                infracao = true;
                motivo = "envio de fotos fora do tema de produção";
            } else if (isAudioOuGravacao && msg.message.audioMessage.seconds < 3) {
                infracao = true;
                motivo = "envio de áudio experimental inválido";
            }

            if (infracao) {
                await socket.sendMessage(from, { react: { text: "❌", key: msg.key } });
                await socket.sendMessage(from, { delete: msg.key });

                let avisos = (global.advertencias.get(sender) || 0) + 1;
                global.advertencias.set(sender, avisos);

                if (avisos >= 3) {
                    await socket.groupParticipantsUpdate(from, [sender], "remove");
                    await socket.sendMessage(from, { text: `🚨 *BANIDO:* O membro @${sender.split('@')[0]} foi expulso após 3 avisos por: *${motivo}*.`, mentions: [sender] });
                    global.advertencias.delete(sender);
                } else {
                    await socket.sendMessage(from, { text: `⚠️ *AVISO [${avisos}/3]:* @${sender.split('@')[0]}, a sua mensagem foi removida por *${motivo}*.`, mentions: [sender] });
                }
                return;
            }
        }

        // Pesquisa de VSTs via YouTube
        if (textoMinusculo.startsWith('!vst')) {
            const termo = textRaw.slice(5).trim();
            if (!termo) return await socket.sendMessage(from, { text: "❌ Digite o VST. Ex: `!vst nexus gratis`" });
            await socket.sendMessage(from, { text: `🔍 A procurar VSTs para: *${termo}*...` });
            const res = await yts(termo + " vst plugin free");
            const vids = res.videos.slice(0, 3);
            if (vids.length === 0) return await socket.sendMessage(from, { text: "❌ Nada encontrado." });
            let txt = `🎹 *VSTs ENCONTRADOS* 🎹\n\n`;
            vids.forEach((v, i) => { txt += `${i+1}️⃣ *${v.title}*\n🔗 Link: ${v.url}\n\n`; });
            return await socket.sendMessage(from, { text: txt });
        }

        // Pesquisa de Dicas via YouTube
        if (textoMinusculo.startsWith('!dicas')) {
            const termo = textRaw.slice(6).trim();
            if (!termo) return await socket.sendMessage(from, { text: "❌ Digite a dúvida. Ex: `!dicas beat no celular`" });
            await socket.sendMessage(from, { text: `💡 A procurar tutoriais para: *${termo}*...` });
            const res = await yts(termo + " tutorial producao musical");
            const vids = res.videos.slice(0, 2);
            let txt = `💡 *TUTORIAIS SELECIONADOS* 💡\n\n`;
            vids.forEach(v => { txt += `🎵 *${v.title}*\n▶️ Assista: ${v.url}\n\n`; });
            return await socket.sendMessage(from, { text: txt });
        }

        // Pesquisa de Canal via YouTube
        if (textoMinusculo.startsWith('!canal')) {
            const termo = textRaw.slice(7).trim();
            if (!termo) return await socket.sendMessage(from, { text: "❌ Digite o canal." });
            await socket.sendMessage(from, { text: `🔎 A procurar o canal de: *${termo}*...` });
            const res = await yts(termo);
            if (!res.channels || res.channels.length === 0) return await socket.sendMessage(from, { text: "❌ Canal não encontrado." });
            const canal = res.channels[0];
            return await socket.sendMessage(from, { text: `🎤 *CANAL ENCONTRADO* 🎤\n\n👤 *Nome:* ${canal.name}\n🔗 *Link:* ${canal.url}` });
        }

        // Interação Automática de Saudações
        const saudaotes = ['olá família', 'ola familia', 'como estão', 'como estao', 'oi', 'olá', 'ola'];
        if (saudaotes.some(s => textoMinusculo.includes(s))) {
            const idMsg = msg.key.id;
            if (!global.respondidos.has(idMsg)) {
                global.respondidos.add(idMsg);
                await socket.sendMessage(from, { text: `👋 Olá! Tudo bem por aqui, focado nos Beats! 🎧\n\nDigita *!menu* para ver os comandos!` }, { quoted: msg });
                setTimeout(() => global.respondidos.delete(idMsg), 60000);
            }
        }

    } catch (error) {
        console.error("Erro interno no bot:", error);
    }
});

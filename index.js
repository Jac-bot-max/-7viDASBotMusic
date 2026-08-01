// Coloque o número novo aqui (sem o sinal de +)
const phoneNumber = "258865560063"; 

// Dentro da lógica de conexão do Baileys:
if (!conn.authState.creds.registered) {
    setTimeout(async () => {
        // Isso vai gerar o código de 8 dígitos no seu log do Render
        let code = await conn.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`\nCÓDIGO PARA CONECTAR NO WHATSAPP: ${code}\n`);
    }, 3000);
}
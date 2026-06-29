const { spawn } = require("child_process");
const path = require("path");
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Servidor para o Render manter o bot vivo
app.get('/', (req, res) => res.send('Jackson Beatz Bot Online!'));
app.listen(port, () => console.log(`Monitorando porta: ${port}`));

function start() {
    // Esse comando inicia o bot que está na pasta tct
    const child = spawn("node", ["index.js"], {
        cwd: path.join(__dirname, "tct"),
        stdio: "inherit",
        shell: true
    });

    child.on("close", (code) => {
        console.log(`Bot parou com código ${code}. Reiniciando...`);
        start();
    });
}

start();

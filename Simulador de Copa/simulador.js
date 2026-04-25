/**
 * Configurações Iniciais
 */
const gitUser = "Joao-Ricardo-S-Magalhaes";

// Base de dados para a Lógica Fuzzy: Define o peso de tradição de cada seleção (0 a 5 títulos)
const titulos = {
    "Brasil": 5, "Alemanha": 4, "Itália": 4, "Argentina": 3,
    "França": 2, "Uruguai": 2, "Espanha": 1, "Inglaterra": 1
};

/**
 * Função: simularJogo
 * Objetivo: Calcular o placar de uma partida usando pesos históricos e lógica fuzzy.
 */
function simularJogo(timeA, timeB) {
    const pesoA = titulos[timeA.name] || 0;
    const pesoB = titulos[timeB.name] || 0;

    // Diferença de títulos para ajuste de probabilidade
    const diff = pesoA - pesoB;

    // Distribuição estatística de placares comuns em Copas do Mundo
    const placares = [
        { placar: [1, 0], peso: 180 }, { placar: [2, 1], peso: 150 },
        { placar: [1, 1], peso: 120 }, { placar: [0, 0], peso: 100 },
        { placar: [2, 0], peso: 90 }, { placar: [3, 1], peso: 50 }
    ];

    // APLICAÇÃO DA LÓGICA FUZZY: 
    // Ajustamos os pesos da lista de placares baseados na diferença de tradição
    const placaresAjustados = placares.map(item => {
        let novoPeso = item.peso;
        const [golsA, golsB] = item.placar;

        if (diff > 0) { // Time A é favorito
            if (golsA > golsB) novoPeso *= (1 + (diff * 0.4)); // Aumenta chance de vitória do favorito
            if (golsB > golsA) novoPeso *= (1 - (diff * 0.15)); // Diminui chance de zebra
        } else if (diff < 0) { // Time B é favorito
            const absDiff = Math.abs(diff);
            if (golsB > golsA) novoPeso *= (1 + (absDiff * 0.4));
            if (golsA > golsB) novoPeso *= (1 - (absDiff * 0.15));
        }
        
        // Redução de chance de empate em jogos com grande disparidade técnica
        if (golsA === golsB && Math.abs(diff) > 2) {
            novoPeso *= 0.5;
        }

        return { ...item, peso: novoPeso };
    });

    // Sorteio baseado no total de pesos acumulados (Roleta)
    const totalPeso = placaresAjustados.reduce((soma, p) => soma + p.peso, 0);
    let rand = Math.random() * totalPeso;
    let res = { golsA: 0, golsB: 0 };

    for (let p of placaresAjustados) {
        rand -= p.peso;
        if (rand <= 0) {
            res = { golsA: p.placar[0], golsB: p.placar[1] };
            break;
        }
    }
    return res;
}

/**
 * Função: simularFaseDeGrupos
 * Executa todos os confrontos de um grupo e gera a tabela de classificação.
 */
function simularFaseDeGrupos(timesDoGrupo) {
    let tabela = timesDoGrupo.map(t => ({ ...t, pontos: 0, saldo: 0 }));
    let jogosOcorridos = [];
    
    // Sistema de Todos contra Todos dentro do grupo
    for (let i = 0; i < tabela.length; i++) {
        for (let j = i + 1; j < tabela.length; j++) {
            const res = simularJogo(tabela[i], tabela[j]);
            jogosOcorridos.push({ timeA: tabela[i].name, timeB: tabela[j].name, res });

            // Atualização de saldo e pontos (Vitória: 3, Empate: 1)
            tabela[i].saldo += (res.golsA - res.golsB);
            tabela[j].saldo += (res.golsB - res.golsA);

            if (res.golsA > res.golsB) tabela[i].pontos += 3;
            else if (res.golsB > res.golsA) tabela[j].pontos += 3;
            else { tabela[i].pontos += 1; tabela[j].pontos += 1; }
        }
    }
    // Ordenação conforme Regra 5: Pontos -> Saldo de Gols -> Sorteio
    const ordenada = tabela.sort((a, b) => b.pontos - a.pontos || b.saldo - a.saldo || Math.random() - 0.5);
    return { tabela: ordenada, jogos: jogosOcorridos };
}

/**
 * Função: jogarMataMata
 * Resolve confrontos eliminatórios, incluindo lógica de desempate por pênaltis.
 */
function jogarMataMata(timeA, timeB) {
    if (!timeA || !timeB) return null;
    let res = simularJogo(timeA, timeB);
    let penA = 0, penB = 0;

    // Se houver empate no tempo regulamentar, inicia disputa de pênaltis
    if (res.golsA === res.golsB) {
        penA = Math.floor(Math.random() * 5) + 1;
        penB = Math.floor(Math.random() * 5);
        while (penA === penB) penB++; // Garante que não haja empate nos pênaltis
    }
    const vencedor = (res.golsA > res.golsB || penA > penB) ? timeA : timeB;
    return { timeA, timeB, vencedor, res, penA, penB };
}

/**
 * Função Principal: gerarCopa
 * Coordena o fluxo da aplicação: Consumo da API -> Grupos -> Mata-Mata -> Envio do Resultado.
 */
async function gerarCopa() {
    try {
        // Busca seleções na API externa
        const response = await fetch("https://development-internship-api.geopostenergy.com/WorldCup/GetAllTeams", {
            headers: { "git-user": gitUser }
        });
        const data = await response.json();
        
        // Normalização dos dados (suporta diferentes formatos de resposta da API)
        const listaBruta = Array.isArray(data) ? data : (data.teams || []);
        const selecoes = listaBruta.map(t => ({
            id: t.token || t.id, // Mapeia token/id da API
            name: t.nome || t.name
        })).filter(t => t.id && t.name);

        if (selecoes.length < 32) return alert("Erro: 32 seleções necessárias.");

        // Sorteio aleatório das seleções nos grupos
        selecoes.sort(() => Math.random() - 0.5);
        const letras = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const classificados = {};
        const dadosRender = {};

        // Processamento da Fase de Grupos
        letras.forEach((l, i) => {
            const times = selecoes.slice(i * 4, i * 4 + 4);
            const res = simularFaseDeGrupos(times);
            dadosRender[l] = res;
            classificados[l] = [res.tabela[0], res.tabela[1]]; // Primeiro e Segundo colocados
        });

        renderGrupos(dadosRender);

        // Chaveamento Mata-Mata
        const oitavas = [
            jogarMataMata(classificados.A[0], classificados.B[1]),
            jogarMataMata(classificados.C[0], classificados.D[1]),
            jogarMataMata(classificados.E[0], classificados.F[1]),
            jogarMataMata(classificados.G[0], classificados.H[1]),
            jogarMataMata(classificados.B[0], classificados.A[1]),
            jogarMataMata(classificados.D[0], classificados.C[1]),
            jogarMataMata(classificados.F[0], classificados.E[1]),
            jogarMataMata(classificados.H[0], classificados.G[1])
        ];

        // Lógica de afunilamento (Quartas, Semis e Final)
        const quartas = [];
        for(let i=0; i<8; i+=2) quartas.push(jogarMataMata(oitavas[i].vencedor, oitavas[i+1].vencedor));

        const semi = [];
        for(let i=0; i<4; i+=2) semi.push(jogarMataMata(quartas[i].vencedor, quartas[i+1].vencedor));

        const finalObj = jogarMataMata(semi[0].vencedor, semi[1].vencedor);

        // Atualização da interface e envio do campeão para a API
        renderBracket(oitavas, quartas, semi, [finalObj], finalObj.vencedor.name);
        await enviarCampeao(finalObj);

    } catch (e) { console.error("Erro crítico na simulação:", e); }
}

/**
 * Funções de Renderização (Interface)
 */
function renderGrupos(dados) {
    const container = document.getElementById("grupos");
    container.innerHTML = "";
    for (let l in dados) {
        const div = document.createElement("div");
        div.className = "grupo";
        let html = `<h3>Grupo ${l}</h3><table style="width:100%; font-size:0.85em; margin-bottom:10px;">
                    <tr style="color:#4cc9f0; border-bottom:1px solid #4cc9f0;"><th>Seleção</th><th>Ptos</th><th>Saldo</th></tr>`;
        
        dados[l].tabela.forEach((t, i) => {
            html += `<tr style="${i<2?'font-weight:bold; color:#fff;':'color:#aaa;'} border-bottom:1px solid #2e3a59;">
                        <td>${t.name}</td><td align="center">${t.pontos}</td><td align="center" style="color:#ff9f1c;">${t.saldo > 0 ? '+'+t.saldo : t.saldo}</td></tr>`;
        });
        html += `</table><div style="border-top:1px dashed #444; padding-top:8px;">`;
        dados[l].jogos.forEach(j => {
            html += `<div style="display:flex; justify-content:center; font-size:0.85em; margin-bottom:4px;">
                        <span style="flex:1; text-align:right; padding-right:8px;">${j.timeA}</span>
                        <span style="background:#2e3a59; padding:0 6px; color:#ff9f1c; font-weight:bold; min-width:40px; text-align:center;">${j.res.golsA} x ${j.res.golsB}</span>
                        <span style="flex:1; text-align:left; padding-left:8px;">${j.timeB}</span>
                    </div>`;
        });
        div.innerHTML = html + `</div>`;
        container.appendChild(div);
    }
}

function renderBracket(oit, qua, sem, fin, camp) {
    const container = document.getElementById("bracket");
    container.innerHTML = "";
    const fases = [{ n: "Oitavas", j: oit }, { n: "Quartas", j: qua }, { n: "Semi", j: sem }, { n: "Final", j: fin }];

    fases.forEach((f, idx) => {
        const titulo = document.createElement("h3");
        titulo.innerText = f.n;
        titulo.style.setProperty('--coluna', idx + 1);
        container.appendChild(titulo);

        f.j.forEach((j, i) => {
            const el = document.createElement("div");
            el.className = "match";
            el.style.gridRow = `${[i*2+2, i*4+3, i*8+5, 9][idx]} / span 2`;
            el.style.setProperty('--coluna', idx + 1);
            
            const pen = (j.penA > 0 || j.penB > 0) ? `<div style="color:#ff9f1c; font-size:0.75em; font-weight:bold; margin:4px 0;">Pênaltis: (${j.penA} x ${j.penB})</div>` : "";
            
            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; width:100%;"><span>${j.timeA.name}</span> <b>${j.res.golsA}</b></div>
                ${pen}
                <div style="display:flex; justify-content:space-between; width:100%;"><span>${j.timeB.name}</span> <b>${j.res.golsB}</b></div>
            `;
            container.appendChild(el);
        });
    });

    const w = document.createElement("div");
    w.className = "match destaque-campeao";
    w.style.gridRow = "9 / span 2";
    w.style.setProperty('--coluna', 5);
    w.innerHTML = `<div class="winner" style="color:#ffd700; font-weight:bold;">🏆 CAMPEÃO:<br>${camp}</div>`;
    container.appendChild(w);
}

/**
 * Função: enviarCampeao
 * Envia o resultado final da simulação para a API de destino.
 */
async function enviarCampeao(f) {
    const p = { 
        "equipeA": f.timeA.id, 
        "equipeB": f.timeB.id, 
        "golsEquipeA": f.res.golsA, 
        "golsEquipeB": f.res.golsB, 
        "golsPenaltyTimeA": f.penA, 
        "golsPenaltyTimeB": f.penB
    };
    console.log("Enviando resultado final:", p);
    try {
        await fetch("https://development-internship-api.geopostenergy.com/WorldCup/FinalResult", {
            method: "POST", 
            headers: { "Content-Type": "application/json", "git-user": gitUser }, 
            body: JSON.stringify(p)
        });
    } catch (e) { console.error("Erro ao enviar resultado final:", e); }
}
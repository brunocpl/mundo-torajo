# Mundo Torajo — Vila de Verade

### ▶ [Jogar agora no navegador](https://brunocpl.github.io/mundo-torajo/)

Protótipo (greybox) de um jogo de plataforma 3D de exploração livre, feito com HTML5, CSS, JavaScript puro e [Three.js](https://threejs.org/) via CDN — sem build tools.

## Como jogar

Na pasta do projeto, rode um servidor local simples:

```bash
npx http-server -p 8080 -c-1
```

e abra http://localhost:8080 (também dá para abrir o `index.html` direto).

## Controles

| Tecla | Ação |
| --- | --- |
| WASD / Setas | mover |
| Espaço | pular (segure no ar com o Linn para planar) |
| Shift | dash / rolamento |
| E / Clique | arremessar a Câmera Mágica |
| Q | sair da captura |
| Mouse | girar a câmera (Roda = zoom) |
| R | voltar ao início |

## Personagens

- **Torajo** — protagonista; captura aliados com a Câmera Mágica.
- **Zulmi** — corre 2x mais rápido e tem pulo duplo.
- **Linn** — plana segurando Espaço no ar.
- **Morajo** — *Hack do Algoritmo*: revela plataformas secretas no céu.

## Objetivo

Colete os 5 Botões de Play Dourados (e os 30 Likes) para abrir o Portal do Estúdio no sul da vila.

## Arquivos

- `index.html` — estrutura e HUD
- `style.css` — estilos da interface
- `game.js` — jogo (cena, física, personagens, captura, sons procedurais)

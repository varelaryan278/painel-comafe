# Painel Comafe

Painel de vendas e tráfego da Comafe Autopeças. Lê os dados do Kommo (somente leitura), separa os leads por anunciante (Alex, Marcos, Matra) e mostra funil, vendas por vendedor, mapa por DDD, campanhas e duplicados.

- **Login** com Better Auth (e-mail e senha; sem cadastro aberto — o admin cria os usuários).
- **Perfis:** `admin` (tudo) e `gestor` (ligado a um anunciante; cadastra os próprios IDs do Meta).
- **Painel público** por link secreto (`/relatorio/<código>`), sem login e sem dados de clientes.
- **Tempo real:** webhook do Kommo → sincroniza → avisa os painéis abertos (Redis pub/sub; sem Redis funciona em um processo só).

Stack: Next.js 16 · Prisma 7 + PostgreSQL · Better Auth · ioredis.

## Subir na VPS

1. Requisitos: Node 20+ (testado no 26), PostgreSQL 14+, Redis (opcional).
2. Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL` — `postgresql://USUARIO:SENHA@HOST:5432/BANCO?schema=public`
   - `REDIS_URL` — `redis://:SENHA@HOST:6379/0` (opcional)
   - `BETTER_AUTH_SECRET` — gere com `openssl rand -base64 48`
   - `APP_URL` e `BETTER_AUTH_URL` — endereço público, ex.: `https://comafe.matratecnologia.com` (sem `/` no final).
     No app da Meta, em Login do Facebook › Configurações, cadastre `APP_URL/api/meta/callback` em "URIs de redirecionamento do OAuth válidos".
   - `KOMMO_TOKEN` — token longo da integração do Kommo
   - `SYNC_SECRET` — gere com `openssl rand -base64 24`
3. Instale, crie as tabelas e o primeiro admin:
   ```bash
   npm ci
   npm run db:deploy          # aplica prisma/migrations no PostgreSQL
   # preencha ADMIN_EMAIL e ADMIN_SENHA no .env, depois:
   npm run criar-admin        # apague ADMIN_SENHA do .env em seguida
   npm run sync               # primeira carga do Kommo (alguns minutos)
   ```
4. Build e execução:
   ```bash
   npm run build
   npm start                  # porta 3000; use PM2/systemd para manter no ar
   ```
5. Proxy reverso (nginx): para o tempo real funcionar, desligue o buffer na rota de eventos:
   ```nginx
   location /api/eventos { proxy_pass http://127.0.0.1:3000; proxy_buffering off; proxy_read_timeout 1h; }
   ```

## Sincronização com o Kommo

- **Webhook (tempo real):** no Kommo, Configurações › Integrações › Webhooks, cadastre
  `https://SEU-DOMINIO/api/kommo/webhook?secret=SYNC_SECRET` nos eventos de lead (adicionado, alterado, mudou de etapa).
  A URL completa aparece em **Usuários e acesso** no painel.
- **Automática:** enquanto o servidor estiver no ar, sincroniza a cada `SYNC_INTERVALO_MIN` minutos (padrão 10).
- **Manual:** botão “Sincronizar agora” (admin), `npm run sync`, ou `POST /api/sync` com o cabeçalho `x-sync-secret`.
- `npm run sync -- --completo` refaz tudo desde `SYNC_DESDE`.
- O token do Kommo **vence em 04/03/2027**. O admin vê um aviso no topo do painel 30 dias antes, e também se o token expirar ou se a sincronização falhar. Gere outro e atualize `KOMMO_TOKEN` (no Easypanel, e reinicie o serviço).

## Anúncios do Meta

A tela **Anúncios** mostra Conta › Campanha › Conjunto › Anúncio com miniatura, prévia real (Feed, Stories, Reels), investimento e os leads que chegam de cada anúncio no Kommo. Dá para marcar vários itens e definir **motor / peça / misto**.

1. Em cada Business Manager, crie um **usuário do sistema** com a conta de anúncios atribuída e gere um token com `ads_read`.
2. No `.env`: `META_TOKEN_ALEX`, `META_TOKEN_MARCOS`, `META_TOKEN_MATRA` (o token define o dono de tudo que roda naquela conta).
3. `npm run sync:meta` (ou o botão “Atualizar do Meta”). Depois atualiza sozinho a cada `META_INTERVALO_MIN` minutos.

“Chegando sem vínculo” lista anúncios que mandam lead mas não estão em nenhuma conta conectada — normalmente uma conta que ainda não liberou o usuário do sistema.

## Regras de negócio

- **Anunciante do lead:** 1) conta do Meta conectada (certo); 2) cadastro manual do gestor (anúncio › conjunto › campanha); 3) sem nada disso, regra provisória pelo final do ID do anúncio: `…0194` Marcos, `…0508` Matra, demais Alex; sem ID, tags `CAMPANHA ALEX/MARCOS/MATRA`; senão “Sem anúncio identificado”.
- **Etapas do funil** (pelo histórico): Qualificados = passou por QLF - Sem Estoque, QLF - Cotando, Esperando Abrir o Motor, Em Negociação ou Ganho; Cotação = QLF - Cotando em diante; Negociação = Em Negociação ou Ganho; Venda = Fechado - ganho.
- **Localidade:** DDD do telefone do contato. O banco guarda só o DDD e um hash do telefone (para achar duplicados) — nenhum nome ou telefone de cliente.
- IDs e números do Kommo ficam em `lib/constantes.ts`.

## Desenvolvimento

```bash
npm run dev           # http://localhost:3000
npm run typecheck && npm run lint
npm run db:migrate    # cria nova migração após mudar prisma/schema.prisma
npm run db:studio     # ver o banco
```

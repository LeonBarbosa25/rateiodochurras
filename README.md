# Rateio do Churras 🔥

Aplicativo web para organizar churrascos, registrar despesas, cadastrar participantes e dividir a conta automaticamente — com desconto justo para quem leva carne/bebida.

Implementa a especificação em `especificacao_sistema_rateio_churrasco.md`: valores em **centavos inteiros**, algoritmo iterativo com piso zero, ajuste de centavos determinístico, página individual do participante por link com token seguro.

## Stack

- **Next.js 14** (App Router, RSC, Server Actions) + **TypeScript** + **Tailwind CSS**
- **Postgres** via driver [`postgres`](https://github.com/porsager/postgres) — funciona em Vercel Postgres, Neon, Supabase ou local
- **Zod** para validação no servidor
- Autenticação por sessão em cookie httpOnly + hash `scrypt`
- Links individuais com token de 24 bytes (base64url)
- Sem código nativo / sem `better-sqlite3` → roda em ambiente serverless da Vercel sem hacks

## Como rodar localmente

### Opção A — usando um Neon ou Vercel Postgres remoto

```bash
git clone <repo>
cd churrasco-rateio
cp .env.example .env.local
# edite .env.local e cole o DATABASE_URL (Neon, Vercel Postgres ou Supabase)

npm install
npm run seed     # cria churrasco de exemplo
npm run dev
```

### Opção B — Postgres local via Docker

```bash
docker run --name churras-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
echo 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres' > .env.local
npm install
npm run seed
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Credenciais do seed:
- E-mail: `demo@churrasco.local`
- Senha: `demo1234`

### Testes do algoritmo

```bash
npm test
```

10 testes cobrindo todos os cenários obrigatórios da especificação (§28).

## Deploy na Vercel

1. Suba este repositório no GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. No projeto recém-criado, vá em **Storage → Create Database → Postgres** (ou conecte um banco Neon/Supabase existente).
   - Vercel injeta automaticamente a env `DATABASE_URL` (e `POSTGRES_URL`). Garanta que `DATABASE_URL` esteja definida; se necessário, copie de `POSTGRES_URL`.
4. Faça o primeiro deploy. O schema é criado automaticamente no primeiro acesso (`CREATE TABLE IF NOT EXISTS …`).
5. (Opcional) Rode o seed apontando localmente para o banco da Vercel:
   ```bash
   DATABASE_URL="<copie do dashboard>" npm run seed
   ```

Nenhuma migration manual é necessária: o módulo `src/lib/db.ts` aplica o schema na primeira query.

### Variáveis de ambiente

| Nome | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | Connection string Postgres. Em Vercel Postgres, copie da aba **.env**. |
| `PGSSL` | opcional | `1` força SSL. Detecção automática se a URL contiver `sslmode=require`. |

## Algoritmo de rateio

Para cada churrasco:

1. `T` = soma das despesas com `included_in_split = 1`
2. Participantes `i` com `participates_in_split = 1` e `active = 1`
3. `Cᵢ` = soma das contribuições aprovadas do participante `i`
4. Busca binária encontra `B` (em centavos) tal que `Σ max(0, B - Cᵢ) = T`
5. `Pᵢ = max(0, B - Cᵢ)` para cada participante
6. Ajuste determinístico de centavos: distribui o resto (positivo ou negativo) priorizando quem tem maior `P`

Garantias:
- `Σ Pᵢ == T` em centavos exatos
- `Pᵢ >= 0` sempre
- Crédito excedente (quando `Cᵢ > B`) é exposto como `excessCreditCents`

## Estrutura

```
src/
  lib/
    db.ts          # cliente Postgres + auto-migrate + helpers dbAll/dbGet/dbExec
    money.ts       # parseBRL / formatBRL em centavos
    rateio.ts      # algoritmo
    rateio.test.ts # testes (node:test)
    queries.ts     # leituras assíncronas + cálculo de resumo
    actions.ts     # server actions (auth, churrasco, despesas, etc.)
    auth.ts        # sessão, hash scrypt, tokens
  app/
    page.tsx                   # lista de churrascos
    login/                     # entrar / criar conta
    churrasco/new/             # criar churrasco
    churrasco/[id]/            # painel + abas (despesas, participantes, contribuições, pagamentos, compartilhar)
    p/[token]/                 # página individual do participante
    c/[token]/                 # página pública geral do churrasco
scripts/seed.ts                # dados de demonstração (Postgres)
```

## Banco

Tabelas conforme spec §22: `users`, `barbecues`, `participants`, `expenses`, `contributions`, `payments`, `audit_logs`, `sessions`. Valores monetários sempre `INTEGER` em centavos (`*_cents`).

## Segurança

- Senhas com `scrypt` + salt aleatório de 16 bytes
- Sessão por cookie httpOnly, sameSite=lax, `secure` em produção
- Tokens de acesso individuais de 24 bytes (base64url) — não previsíveis
- Toda mutação valida com Zod e checa `owner_id` antes de gravar
- Página pública geral não revela valores individuais por participante

## Próximos passos (fora do MVP)

- Confirmação de presença e quantidade por perfil (§25.1/25.2)
- Rateio ponderado por peso (§25.3)
- Separação de grupos de despesas (§25.4)
- Lista de "o que cada um leva" (§25.5)
- Controle de sobras (§25.6)
- Relatórios PDF/Excel (§25.7)
- Lembretes WhatsApp/e-mail (§25.8)
- Churrascos recorrentes/duplicação (§25.9)
- QR Code Pix dinâmico

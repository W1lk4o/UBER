# Motorista Pro

App web simples para motorista de Uber, pronto para GitHub + Vercel + Supabase.

## Arquivos principais
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `vercel.json`
- `docs/supabase.sql`

## Como publicar
1. Extraia o zip.
2. Envie os arquivos **de dentro da pasta** para a raiz do repositório no GitHub.
3. Na raiz do GitHub, você deve ver direto:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `manifest.webmanifest`
   - `vercel.json`
4. Na Vercel, importe o repositório.
5. Use `Other` como framework.
6. No campo Root Directory, selecione a pasta raiz onde está o `index.html`.
7. Deixe Build Command vazio.
8. Deixe Output Directory vazio.

## Supabase
1. Crie um projeto grátis.
2. Rode o SQL do arquivo `docs/supabase.sql`.
3. No app, toque em `Supabase`.
4. Cole a URL do projeto e a chave pública `anon`.
5. Crie sua conta e entre.

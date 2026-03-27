# Motorista Pro + Supabase

Aplicação estática para GitHub + Vercel com persistência em nuvem via Supabase.

## Arquivos principais
- `index.html`
- `app.js`
- `styles.css`
- `manifest.webmanifest`
- `vercel.json`
- `docs/supabase.sql`

## Como subir
1. Extraia o zip.
2. Envie os arquivos para a raiz do repositório no GitHub.
3. Importe o repositório na Vercel.
4. Preset: `Other`
5. Root Directory: `.`
6. Build Command: vazio
7. Output Directory: `.`

## Como ligar no Supabase
1. Crie um projeto no Supabase.
2. Rode o SQL do arquivo `docs/supabase.sql`.
3. Em Authentication > Sign In / Providers, deixe Email habilitado.
4. Em Project Settings > API, copie a Project URL e a anon public key.
5. Abra o app publicado, toque em `Supabase`, cole os dados e salve.
6. Crie sua conta e entre.

## Observação importante
Nunca use a `service_role key` no frontend.

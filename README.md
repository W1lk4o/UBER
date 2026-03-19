# Motorista Pro

Aplicação web simples para acompanhar:

- hora que iniciou o trabalho
- cronômetro com pausa e continuação
- quilometragem inicial e final
- faturamento bruto
- gasto com combustível
- lucro líquido
- corridas
- resumo por semana, mês, ano ou intervalo personalizado
- histórico salvo no navegador

## Publicar com GitHub + Vercel

1. Crie um repositório no GitHub.
2. Envie estes arquivos para o repositório.
3. Entre na Vercel e importe o projeto do GitHub.
4. Faça o deploy.

Como é um projeto estático, a Vercel publica sem backend.

## Importante

Os dados ficam salvos no navegador usando `localStorage`.
Isso funciona muito bem para começar de graça, mas os dados não sincronizam entre aparelhos.
Na próxima versão, vale colocar login e banco de dados para não perder histórico ao trocar de celular.

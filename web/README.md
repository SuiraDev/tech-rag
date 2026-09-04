# Resenha — Web

Interface Next.js da aplicação Resenha. Por ela é possível enviar documentos e conversar com o conteúdo indexado pela API.

## Pré-requisitos

- Node.js 20 ou superior
- A [API da raiz do repositório](../README.md) ativa em `http://localhost:3000`, com Ollama e Qdrant configurados

## Executar localmente

1. Em um terminal, inicie os serviços e a API seguindo o [README da API](../README.md).

2. Neste diretório, instale as dependências:

   ```bash
   npm install
   ```

3. Inicie a interface:

   ```bash
   npm run dev
   ```

4. Acesse `http://localhost:3001` no navegador.

Por padrão, o frontend se conecta a `http://localhost:3000`. Para usar uma API em outro endereço, crie `web/.env.local` com:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Reinicie `npm run dev` após alterar essa variável.

## Usar a aplicação

1. Abra a área de documentos e envie um PDF ou adicione conteúdo em Markdown para indexá-lo.
2. Aguarde a conclusão da indexação.
3. Abra o chat, faça uma pergunta sobre o material enviado e consulte as fontes retornadas na resposta.

## Trocar o modelo de 4B para 8B

A escolha do modelo é feita exclusivamente na API, não neste projeto web. Na raiz do repositório, baixe `qwen3:8b` com Ollama e altere `OLLAMA_CHAT_MODEL` no arquivo `.env` para `qwen3:8b`; depois reinicie a API. Veja o passo a passo completo no [README da API](../README.md#trocar-o-modelo-de-4b-para-8b).

Nenhuma mudança no código ou nas variáveis do frontend é necessária.

## Comandos úteis

```bash
npm run lint
npm run build
npm run start
```

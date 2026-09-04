# Resenha — API

API NestJS para indexar documentos, buscar conteúdo no Qdrant e responder perguntas com RAG usando modelos locais do Ollama. A interface web está no projeto [`web`](./web/README.md).

## Pré-requisitos

- Node.js 20 ou superior
- Docker e Docker Compose (para o Qdrant)
- [Ollama](https://ollama.com/) em execução localmente

## Executar localmente

1. Instale as dependências da API:

   ```bash
   npm install
   ```

2. Crie o arquivo de ambiente a partir do exemplo e complete as variáveis usadas pela aplicação:

   ```bash
   cp .env.example .env
   ```

   O arquivo `.env` deve conter, no mínimo:

   ```dotenv
   DATABASE_URL="file:./dev.db"
   PORT=3000
   WEB_ORIGIN=http://localhost:3001

   OLLAMA_URL=http://localhost:11434
   OLLAMA_CHAT_MODEL=qwen3:4b
   OLLAMA_EMBEDDING_MODEL=nomic-embed-text

   QDRANT_URL=http://localhost:6333
   QDRANT_COLLECTION=tech_knowledge
   ```

3. Baixe os modelos locais necessários e inicie o Ollama, caso ele ainda não esteja ativo:

   ```bash
   ollama pull qwen3:4b
   ollama pull nomic-embed-text
   ollama serve
   ```

   Em instalações que executam o Ollama como serviço, o último comando não é necessário.

4. Suba o Qdrant:

   ```bash
   docker compose up -d
   ```

5. Gere o cliente Prisma e sincronize o banco SQLite local:

   ```bash
   npm run prisma:generate
   npx prisma db push
   ```

6. Inicie a API em modo de desenvolvimento:

   ```bash
   npm run start:dev
   ```

   A API estará disponível em `http://localhost:3000`; uma requisição a `GET /` confirma que ela está ativa.

Para usar a aplicação completa, em outro terminal inicie a interface com `cd web && npm install && npm run dev` e abra `http://localhost:3001`.

## Trocar o modelo de 4B para 8B

O modelo de chat padrão é `qwen3:4b`. Para usar a variante de 8 bilhões de parâmetros:

1. Baixe o modelo:

   ```bash
   ollama pull qwen3:8b
   ```

2. No `.env`, altere somente a variável de chat:

   ```dotenv
   OLLAMA_CHAT_MODEL=qwen3:8b
   ```

3. Reinicie a API (`npm run start:dev`).

Não é necessário reindexar os documentos: `OLLAMA_EMBEDDING_MODEL=nomic-embed-text` continua responsável pelos vetores. Só reindexe se também mudar o modelo de embeddings; nesse caso, use uma nova coleção Qdrant ou recrie a coleção existente, pois a dimensão dos vetores pode mudar.

O modelo 8B costuma produzir respostas melhores, mas requer mais memória RAM/VRAM e pode responder mais lentamente. Confirme os modelos instalados com `ollama list`.

## Comandos úteis

```bash
npm run test        # testes unitários
npm run build       # build de produção
docker compose down # interrompe o Qdrant sem apagar o volume de dados
```

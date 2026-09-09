# API Backend - Sistema de Simulados

API desenvolvida em Node.js utilizando Express e Prisma ORM, integrada ao PostgreSQL (Supabase) para o gerenciamento de alunos, questões, simulados e resultados de avaliações.

## Tecnologias Utilizadas

- Node.js
- Express
- Prisma ORM
- PostgreSQL / Supabase

## Estrutura do Banco de Dados

- **Aluno**: Armazena as informações cadastrais (`matricula`, `nome`, `email`).
- **Questao**: Banco de questões contendo disciplina, enunciado, gabarito e nível de dificuldade.
- **Simulado**: Agrupamento de avaliações por título e data.
- **Resultado**: Tabela relacional que armazena as notas obtidas pelos alunos nos simulados.

## Como Executar Localmente

1. Clone o repositório e abra a pasta no terminal.
2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto configurando as variáveis de conexão:
   ```env
   DATABASE_URL="sua_url_do_supabase"
   DIRECT_URL="sua_url_direta_do_supabase"
   ```

4. Inicie o servidor:
   ```bash
   node server.js
   ```
   O serviço rodará em `http://localhost:3000`.

## Endpoints da API

### Alunos
- `POST /alunos`: Cadastra um novo aluno (com validação de campos obrigatórios e duplicidade de matrícula).
- `GET /alunos`: Lista todos os registros de alunos com seus respectivos históricos e simulados.
- `PUT /alunos/:id`: Atualiza os dados de cadastro de um aluno específico.
- `DELETE /alunos/:id`: Remove o aluno e seus registros vinculados do sistema.
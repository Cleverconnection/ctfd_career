# CTFd Career Plugin

Plugin oficial da plataforma CTF-Platform para gerenciamento de trilhas de carreira dentro do CTFd 4.x. Compatível com Python 3.11, tema core-beta e com suporte completo a internacionalização (pt-BR e en-US).

## Instalação

1. Copie o diretório `ctfd_career` para a pasta `CTFd/plugins/`.
2. Ative o plugin adicionando `ctfd_career` à variável de ambiente `CTFD_PLUGINS` ou registrando-o manualmente no `config.py`.
3. Reinicie a aplicação CTFd. O log exibirá:

```
<<<<< CTFd Career Plugin loaded successfully >>>>>
```

## Estrutura do Projeto

```
ctfd_career/
├── __init__.py
├── models.py
├── routes.py
├── services/
│   ├── progress.py
│   └── sync.py
├── static/
│   ├── css/
│   │   └── career.css
│   ├── img/
│   │   └── icons/
│   └── js/
│       ├── admin.js
│       └── progress.js
├── templates/
│   ├── admin.html
│   ├── progress.html
│   └── components/
│       └── progress_bar.html
└── translations/
    ├── en/translations.json
    └── pt_BR/translations.json
```

## Configuração

- **Blueprint**: registrado em `/plugins/career` com assets acessíveis via `/plugins/ctfd_career/static/`.
- **Internacionalização**: traduções gerenciadas por JSON, automaticamente carregadas conforme o locale do usuário (`pt_BR` ou `en`).
- **Estilos**: `static/css/career.css` utiliza classes compatíveis com o tema core-beta (`card`, `badge`, `progress`).
- **Logging**: mensagem padrão para observabilidade durante o carregamento do plugin.

## Banco de Dados

O plugin cria automaticamente as tabelas ao ser carregado:

- `careers`: metadados das carreiras (nome, descrição, ícone, cor).
- `career_steps`: etapas de cada carreira (descrição, categoria, número mínimo de resoluções).
- `career_user_progress`: relação usuário × etapa com estado de conclusão.

O método `ctfd_career.models.update_progress(user_id)` recalcula o progresso de um usuário com base nas solves registradas em `CTFd.models.Solves`, incluindo desafios padrão, módulos (`ctfd-modules`) e desafios de múltipla escolha (`ctfd-plugin-choice-challenge`).

## Endpoints de API

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/plugins/career/api/v1/career` | Jogador | Lista carreiras com progresso individual |
| POST | `/plugins/career/api/v1/career` | Admin | Cria nova carreira |
| GET | `/plugins/career/api/v1/career/steps/<career_id>` | Jogador | Lista etapas da carreira |
| POST | `/plugins/career/api/v1/career/steps` | Admin | Cria etapa |
| GET | `/plugins/career/api/v1/career/progress` | Jogador | Progresso consolidado do usuário |
| PUT | `/plugins/career/api/v1/career/sync` | Admin | Recalcula progresso de todos os usuários |
| GET | `/plugins/career/api/v1/career/progress/<user_id>` | Admin | Progresso detalhado de um usuário |
| GET | `/plugins/career/api/v1/career/summary` | Admin | Sumário de conclusão por carreira |

## Integração com Outros Plugins

- **ctfd-modules**: etapas podem ser vinculadas a categorias ou módulos; o cálculo de progresso considera `module_id` quando disponível.
- **ctfd-plugin-choice-challenge**: desafios de múltipla escolha registram solves da mesma forma que os desafios padrão e são considerados automaticamente no progresso.
- **Ranking**: o cálculo se baseia em solves oficiais, preservando compatibilidade com o ranking e awards do CTFd.

## Painéis

- **Jogador** (`/plugins/career`): painel responsivo com barra de progresso, etapas concluídas/pedentes, ícones e mensagens motivacionais conforme JSON de tradução.
- **Administrador** (`/plugins/career/admin`): CRUD de carreiras e etapas, resumo por carreira, botão de “Recalcular Progresso”.

## Traduções

Arquivos JSON localizados em `translations/en/` e `translations/pt_BR/` contendo as chaves utilizadas nos templates e scripts. Para adicionar novos idiomas, crie um diretório seguindo a convenção ISO (`es`, `fr`, etc.) e adicione `translations.json` correspondente.

## Testes

Testes básicos com `pytest` garantem:

1. Criação de carreiras.
2. Adição de etapas.
3. Recalculo de progresso ao resolver desafios.

Execute:

```
pytest -q --disable-warnings
```

## Compatibilidade

- CTFd >= 4.0
- Python 3.11
- MariaDB/MySQL 10.x ou PostgreSQL 13+
- SQLAlchemy 2.x
- Tema core-beta

## Licença

Distribuído sob a licença MIT (mesma licença do projeto original). forked from Bitbl4ck/ctfd_career Thank you!

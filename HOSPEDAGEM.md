# CEI Admin — dados na hospedagem

A base administrativa e os arquivos da APP são gravados no armazenamento persistente R2 da hospedagem atual. Não há chamadas ao Google Drive. A base do servidor é a referência compartilhada. Rascunhos e dados carregados ficam apenas na memória da aba; aguarde a confirmação do servidor antes de fechar.

Em **Segurança**, use **Baixar backup completo**. O JSON versão 2 contém biblioteca, empréstimos, usuários da biblioteca, lista de espera, documentos, ofícios, encaminhamentos, preferências e todos os anexos da APP (incluindo atas assinadas e arquivos iniciais). Cada anexo contém checksum SHA-256. Um backup só é entregue se a base continuar igual durante a exportação. Não inclui código de aplicação nem credenciais.

Para mudar de servidor:
1. Leve o código deste projeto e seu diretório `dist` compilado.
2. Disponibilize armazenamento persistente. Para Node 22+, execute `node scripts/portable-server.mjs` com `PUBLIC_ORIGIN=https://seu-dominio`, `DATA_DIR=/caminho/persistente/cei` e opcionalmente `PORT=3000`. Use um único processo Node para esse adaptador. Não use disco efêmero.
3. Configure autenticação confiável no novo provedor antes de abrir a área interna. O adaptador Node fornecido não implementa login e descarta cabeçalhos de identidade enviados pelo cliente. Não o exponha aceitando cabeçalhos de identidade arbitrários. A autenticação atual é fornecida pelo Sites, por meio de Entrar com ChatGPT. Depois, abra o novo site e restaure o JSON em **Segurança → Restaurar backup completo**.
4. Confira os registros e downloads antes de desativar a hospedagem anterior. Evite alterações durante a exportação/restauração.

A restauração prepara uma base separada, valida todos os anexos e só então ativa a nova base. Se houver alterações concorrentes, não substitui a base atual. A geração anterior permanece no armazenamento; os uploads de restauração interrompidos não são publicados. Backups guardados em outros computadores são a proteção contra a perda do provedor.

A página inicial é pública. APIs administrativas, backups, documentos pessoais e arquivos da APP não publicados exigem autorização no servidor. O Sites fornece a identidade verificada (`oai-authenticated-user-id` e e-mail); a aplicação resolve os perfis Administrativo, Docente e Bloqueado. A variável de ambiente secreta `CEI_BOOTSTRAP_ADMIN_EMAIL` identifica a conta proprietária de recuperação e deve ser configurada novamente em outra hospedagem.

Em **Acessos e publicações**, administradores cadastram e-mails, atribuem perfis e escolhem os documentos destinados à comunidade. Docentes veem apenas seus próprios relatórios, registros de alimentação e empréstimos; solicitam livros, e a administração aprova ou recusa. O vínculo opcional com um leitor existente preserva o acesso ao histórico correto. As permissões, solicitações, vínculos e publicações ficam em `state.portal` / registros associados e integram o backup completo. Restaurar um backup também restaura essas permissões: confira a equipe após a restauração.

Os registros de prática alimentar são guardados em documentos gerados. Suas fotografias são anexos persistentes e integram o backup completo, sem aparecer no acervo financeiro da APP.

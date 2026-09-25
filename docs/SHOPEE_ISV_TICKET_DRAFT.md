# Rascunho seguro — solicitação Shopee para operação multiusuário

> Preencher os campos entre colchetes somente com dados reais antes do envio.

**Assunto:** Orientação/solicitação para Third-Party Partner (ISV) e app ERP System — Gestor Sênior

Prezados,

Desenvolvo o **Gestor Sênior**, uma aplicação web para gestão de operações Shopee. O sistema já possui cadastro e login próprios e vincula cada usuário à loja que ele mesmo autoriza pela Shopee Open Platform.

Hoje o aplicativo Shopee utilizado pelo projeto está na categoria **Seller In House System**. Como a próxima etapa do Gestor Sênior é permitir que vendedores terceiros criem suas próprias contas e autorizem suas próprias lojas, solicito orientação e avaliação para operar no perfil **Third-Party Partner (ISV)** e, quando aplicável, criar um novo aplicativo da categoria **ERP System**.

Dados:
- Website: [URL pública]
- Política de Privacidade: [URL /privacidade]
- Termos de Uso: [URL /termos]
- Documentação técnica: [URL /docs/tecnica]
- CNPJ/CPF: [DADO REAL]
- Representante: [NOME REAL]
- E-mail profissional: [E-MAIL REAL]
- Telefone: [TELEFONE REAL]

Arquitetura atual resumida:
- Next.js 14 / React 18 hospedado na Vercel;
- Supabase para autenticação e banco de dados;
- sessão do Gestor em cookie HttpOnly assinado;
- credenciais OAuth da Shopee processadas no servidor;
- autorização Shopee vinculada ao usuário autenticado;
- isolamento da loja vinculada por conta.

Posso fornecer demonstração, screenshots e credenciais de teste se forem necessárias ao processo de avaliação.

Atenciosamente,
[NOME REAL]
Gestor Sênior

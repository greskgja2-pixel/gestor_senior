// Fonte única do canal de atualização e da página do Motor.
// Atualizar somente após conferir o pacote distribuído e suas notas.
export const MOTOR_RELEASE = Object.freeze({
  version: '0.20.3',
  version_name: '0.20.3 - Sessão do Gestor',
  filename: 'Motor-Senior-v0.20.3-Sessao-Gestor.zip',
  notes: 'Corrige o erro "Faça login para acessar o Gestor Sênior" na Super Análise: as chamadas da extensão ao Gestor agora enviam o cookie de login e usam o domínio da aba do Gestor onde você está logado (o padrão passou a ser shopeeos-real-greskgja.vercel.app). Inclui a v0.20.2: a lista de conversas do Messenger aceita mais formatos de resposta e devolve um diagnóstico quando vier vazia. Inclui a v0.20.1: coleta do Funil mais resiliente (nova tentativa por página do ranking, timeout maior e lotes menores). Nenhuma ação de coleta da Shopee foi alterada nesta versão.',
  download_url: 'https://shopeeos-real-greskgja.vercel.app/motor-senior',
  published_at: '2026-10-21T19:00:00.000Z'
});

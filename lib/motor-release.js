// Fonte única do canal de atualização e da página do Motor.
// Atualizar somente após conferir o pacote distribuído e suas notas.
export const MOTOR_RELEASE = Object.freeze({
  version: '0.20.1',
  version_name: '0.20.1 - Coleta do Funil mais resiliente',
  filename: 'Motor-Senior-v0.20.1-Funil-Resiliente.zip',
  notes: 'sellerFunnel: paginação do ranking de produtos (funil por produto) agora tenta novamente, de forma sequencial, qualquer página que falhe no primeiro lote, com timeout maior para past7days/past30days/yesterday e lotes concorrentes menores (2 em vez de 4). A resposta passa a incluir "collection" (páginas esperadas/falhas e produtos coletados) para diagnosticar coleta incompleta sem inventar dado. Sem mudança de período, protocolo de mensagens ou das demais ações do Motor.',
  download_url: 'https://shopeeos-real-greskgja.vercel.app/motor-senior',
  published_at: '2026-10-15T00:57:09.000Z'
});

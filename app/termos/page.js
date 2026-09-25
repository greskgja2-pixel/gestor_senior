import PublicInfoLayout from '../components/PublicInfoLayout';
import styles from '../public-info.module.css';
export const metadata={title:'Termos de Uso | Gestor Sênior'};
export default function Page(){
 return <PublicInfoLayout eyebrow="Termos" title="Termos de Uso" lead="Condições atuais para uso do Gestor Sênior durante a fase de preparação multiusuário.">
  <section className={styles.section}><h2>1. Serviço</h2><p>O Gestor Sênior é uma plataforma independente de gestão e inteligência para vendedores Shopee. O serviço depende de integrações e permissões fornecidas pela Shopee e de provedores de infraestrutura externos.</p></section>
  <section className={styles.section}><h2>2. Conta e autorização</h2><p>O usuário é responsável pelos dados usados para criar sua conta e por manter sua senha em segurança. A conexão de uma loja Shopee deve ser autorizada pelo usuário que possua permissão legítima para administrá-la.</p></section>
  <section className={styles.section}><h2>3. Uso permitido</h2><ul><li>Usar a plataforma somente para operações que o usuário esteja autorizado a administrar.</li><li>Não tentar acessar dados de outras contas, contornar controles de segurança ou explorar vulnerabilidades.</li><li>Não usar o serviço para fraude, manipulação artificial de métricas, spam ou violação das regras da Shopee.</li></ul></section>
  <section className={styles.section}><h2>4. Disponibilidade</h2><p>Esta versão está em evolução. Não há, neste momento, um SLA comercial de disponibilidade publicado. Interrupções da Shopee Open Platform, da Vercel, do Supabase ou de outros serviços externos podem afetar recursos do Gestor Sênior.</p></section>
  <section className={styles.section}><h2>5. Planos e pagamentos</h2><p>Planos comerciais e meios de pagamento ainda não são declarados nestes termos. Valores, cobrança, renovação e cancelamento somente passarão a valer quando forem publicados de forma explícita.</p></section>
  <section className={styles.section}><h2>6. Alterações e suporte</h2><p>Estes termos podem ser atualizados à medida que a plataforma evoluir. Um canal oficial de suporte e contato jurídico será publicado antes da abertura comercial ampla.</p></section>
 </PublicInfoLayout>
}
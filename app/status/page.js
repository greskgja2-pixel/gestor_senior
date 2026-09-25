import PublicInfoLayout from '../components/PublicInfoLayout';
import styles from '../public-info.module.css';
export const metadata={title:'Status | Gestor Sênior'};
export default function Page(){
 return <PublicInfoLayout eyebrow="Status" title="Status do Gestor Sênior" lead="Página pública de transparência da fase atual do produto.">
  <section className={styles.section}><div className={styles.status}><span className={styles.dot}/>Aplicação web disponível</div><p className={styles.muted}>O Gestor Sênior está em fase de evolução controlada para suporte a múltiplos usuários.</p></section>
  <section className={styles.section}><h2>Componentes</h2><ul><li>Cadastro e login do Gestor Sênior: implementados.</li><li>Vinculação da loja Shopee por usuário: implementada no aplicativo.</li><li>Painel administrativo de usuários: implementado.</li><li>Solicitação/perfil de parceiro Shopee apropriado para operação com lojas de terceiros: etapa externa pendente.</li></ul></section>
  <p className={styles.notice}>Esta página ainda não representa um SLA nem um monitor de uptime independente. Um histórico de incidentes e métricas de disponibilidade poderá ser adicionado antes da operação comercial ampla.</p>
 </PublicInfoLayout>
}
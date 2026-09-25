import Link from 'next/link';
import PublicInfoLayout from '../components/PublicInfoLayout';
import styles from '../public-info.module.css';

export const metadata={title:'Gestor Sênior | Gestão para operações Shopee',description:'Plataforma de gestão e inteligência para vendedores Shopee.'};

export default function Page(){
  return <PublicInfoLayout title="Gestão e inteligência para sua operação Shopee" lead="O Gestor Sênior reúne dados e ferramentas de operação em um painel único. Cada usuário cria sua própria conta e autoriza a própria loja por meio da integração com a Shopee Open Platform.">
    <div className={styles.grid}>
      <article className={styles.card}><h2>Operação centralizada</h2><p>Produtos, pedidos, indicadores e recursos de gestão reunidos no mesmo ambiente.</p></article>
      <article className={styles.card}><h2>Inteligência de anúncio</h2><p>Super Análise, acompanhamento de concorrentes, prioridades e histórico para apoiar decisões.</p></article>
      <article className={styles.card}><h2>Shopee Ads</h2><p>Leitura de desempenho e recursos de apoio à gestão de campanhas conforme as permissões disponíveis na conta conectada.</p></article>
    </div>
    <section className={styles.section}><h2>Como funciona o acesso</h2><div className={styles.steps}>
      <div className={styles.step}><div><b>Crie sua conta</b><span>Cadastro com nome, e-mail e senha no Gestor Sênior.</span></div></div>
      <div className={styles.step}><div><b>Entre no painel</b><span>A sessão do Gestor é protegida e separada da autorização da loja.</span></div></div>
      <div className={styles.step}><div><b>Autorize sua loja Shopee</b><span>A conexão é iniciada pelo próprio usuário e vinculada à conta autenticada.</span></div></div>
      <div className={styles.step}><div><b>Use os dados da sua operação</b><span>O painel consulta somente a loja vinculada àquela conta.</span></div></div>
    </div></section>
    <p className={styles.notice}>O Gestor Sênior está em evolução para operação multiusuário. Nesta etapa, cada conta do Gestor Sênior mantém uma loja Shopee vinculada por vez.</p>
    <p><Link className={styles.primary} href="/cadastro">Criar minha conta</Link></p>
  </PublicInfoLayout>
}
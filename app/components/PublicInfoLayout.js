import Link from 'next/link';
import styles from '../public-info.module.css';

const links=[
  ['Apresentação','/apresentacao'],
  ['Privacidade','/privacidade'],
  ['Termos','/termos'],
  ['Documentação técnica','/docs/tecnica'],
  ['Status','/status']
];

export default function PublicInfoLayout({eyebrow='Gestor Sênior',title,lead,children}){
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/apresentacao" className={styles.brand}><span>GS</span><b>Gestor Sênior</b></Link>
      <nav>{links.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</nav>
      <div className={styles.actions}><Link href="/login">Entrar</Link><Link className={styles.primary} href="/cadastro">Criar conta</Link></div>
    </header>
    <main className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        {lead&&<p>{lead}</p>}
      </section>
      {children}
    </main>
    <footer className={styles.footer}>
      <b>Gestor Sênior</b><span>Plataforma independente de gestão para operações Shopee.</span>
      <span>Shopee é marca de seus respectivos titulares. O Gestor Sênior não se apresenta como produto oficial da Shopee.</span>
    </footer>
  </div>
}
export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }) {
  const hasError = searchParams?.error === "1";
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">GESTOR SENIOR</p>
        <h1>Acesso privado</h1>
        <p>Entre para acessar os dados da sua loja Shopee.</p>
        <form action="/api/auth/login" method="post">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          {hasError && <p className="login-error">Senha incorreta.</p>}
          <button className="btn" type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}

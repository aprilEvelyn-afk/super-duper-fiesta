export default function Home({ user, accounts }) {
  return (
    <div style={{ padding: 20 }}>
      <h1>Super Duper Fiesta — Accounts</h1>
      {!user && <p>Please <a href="/login">log in</a> or <a href="/register">register</a>.</p>}
      {user && (
        <>
          <p>Signed in as {user.email}</p>
          <h2>Accounts</h2>
          <ul>
            {accounts.map(a => (
              <li key={a.id}>{a.type} — {a.currency} — balance: {a.balance}</li>
            ))}
          </ul>
          <button onClick={async () => {
            await fetch('http://localhost:3000/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}>Logout</button>
        </>
      )}
    </div>
  )
}

export async function getServerSideProps(ctx) {
  const headers = ctx.req.headers;
  const auth = headers.cookie || '';
  // No SSR auth, frontend is simple: rely on client fetch
  let user = null;
  let accounts = [];
  try {
    const res = await fetch('http://localhost:3000/auth/me', { headers: { authorization: headers['authorization'] || '' } });
    const data = await res.json();
    if (data.authenticated) {
      user = data.user;
      accounts = data.accounts || [];
    }
  } catch (e) {
    // ignore
  }
  return { props: { user, accounts } };
}

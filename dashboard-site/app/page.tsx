import { requireAllowedUser } from "./authorization";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireAllowedUser("/");

  return (
    <main>
      <h1>JJ AI Team Dashboard</h1>
    </main>
  );
}

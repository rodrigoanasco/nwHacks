import {RegisterLink, LoginLink} from "@kinde-oss/kinde-auth-nextjs/components";

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>BlenderCode (MVP)</h1>
      <p>LeetCode-style challenges for Blender scripting.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <LoginLink>Sign in</LoginLink>
        <RegisterLink>Sign up</RegisterLink>
      </div>

      <div style={{ marginTop: 16 }}>
        <a href="/dashboard">Go to dashboard</a>
      </div>
    </main>
  );
}

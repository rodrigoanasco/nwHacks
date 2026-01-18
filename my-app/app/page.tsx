import Link from "next/link";
import { LoginLink, RegisterLink } from "@kinde-oss/kinde-auth-nextjs/components";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

type ChallengeRow = {
  title: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  status: "Available" | "Locked" | "Completed";
  points: number;
};

const challenges: ChallengeRow[] = [
  { title: "Select & Rename Objects", topic: "Basics", difficulty: "Easy", status: "Available", points: 50 },
  { title: "Generate Mesh from JSON", topic: "Geometry", difficulty: "Medium", status: "Available", points: 120 },
  { title: "Batch Export FBX", topic: "Pipeline", difficulty: "Medium", status: "Locked", points: 140 },
  { title: "Materials: Assign by Rule", topic: "Materials", difficulty: "Easy", status: "Locked", points: 70 },
  { title: "Scene Cleanup Script", topic: "Automation", difficulty: "Easy", status: "Available", points: 60 },
  { title: "Collections & Visibility", topic: "Scenes", difficulty: "Hard", status: "Locked", points: 220 },
];

function DifficultyBadge({ value }: { value: ChallengeRow["difficulty"] }) {
  // Keep styling minimal; no loud colors
  const variant =
    value === "Easy" ? "secondary" : value === "Medium" ? "default" : "outline";
  return <Badge variant={variant}>{value}</Badge>;
}

function StatusBadge({ value }: { value: ChallengeRow["status"] }) {
  const variant =
    value === "Completed" ? "default" : value === "Available" ? "secondary" : "outline";
  return <Badge variant={variant}>{value}</Badge>;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl border bg-card">
            <span className="text-sm font-semibold">BC</span>
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold">BlenderCode</div>
            <div className="text-xs text-muted-foreground">LeetCode-style Blender scripting</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LoginLink>
            <Button variant="ghost" className="h-9">
              Sign in
            </Button>
          </LoginLink>
          <RegisterLink>
            <Button className="h-9">Sign up</Button>
          </RegisterLink>
        </div>
      </header>

      <Separator />

      {/* Content */}
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Hero */}
        <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Practice Blender scripting like you practice LeetCode</CardTitle>
              <CardDescription className="text-base">
                Short challenges build the problem-solving habit. Here, that habit becomes{" "}
                <span className="font-medium text-foreground">automation, tools, and pipelines in Blender</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Node.js + Next.js</Badge>
                <Badge variant="secondary">MongoDB progress (soon)</Badge>
                <Badge variant="outline">MVP</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/dashboard">Go to dashboard</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/dashboard">View challenge list</Link>
                </Button>
              </div>

              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Table-style learning</CardTitle>
                    <CardDescription className="text-xs">
                      Structured problems + clear progression.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Real scripts</CardTitle>
                    <CardDescription className="text-xs">
                      Useful Blender tasks, not toy examples.
                    </CardDescription>
                  </CardHeader>
                </Card>
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Progress tracking</CardTitle>
                    <CardDescription className="text-xs">
                      MongoDB-backed stats coming soon.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Side panel */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
              <CardDescription>
                Keep it simple: read → code → run → improve.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">1) Pick a challenge</div>
                <div className="text-muted-foreground">Small tasks you can finish in one sitting.</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">2) Write the script</div>
                <div className="text-muted-foreground">Learn Blender Python patterns through reps.</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">3) Build your toolkit</div>
                <div className="text-muted-foreground">Exporters, generators, batch tools, cleanup scripts.</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table section */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Challenges preview</CardTitle>
              <CardDescription>
                A structured, LeetCode-like list (MVP preview — not wired up yet).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border">
                <Table>
                  <TableCaption>Start with Easy, build consistency, then increase difficulty.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Challenge</TableHead>
                      <TableHead className="hidden sm:table-cell">Topic</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {challenges.map((c) => (
                      <TableRow key={c.title} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{c.title}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          {c.topic}
                        </TableCell>
                        <TableCell>
                          <DifficultyBadge value={c.difficulty} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={c.status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to save progress, streaks, and completions.
                </p>
                <div className="flex gap-2">
                  <LoginLink>
                    <Button variant="outline" className="h-9">
                      Sign in
                    </Button>
                  </LoginLink>
                  <RegisterLink>
                    <Button className="h-9">Create account</Button>
                  </RegisterLink>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What you'll learn */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-lg">What you’ll learn</CardTitle>
              <CardDescription>Focused skills that compound over time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">Blender API patterns</div>
                <div className="text-muted-foreground">bpy context, operators, data blocks.</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">Automation workflows</div>
                <div className="text-muted-foreground">Batch export, cleanup, generation, rules.</div>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <div className="font-medium">Pipeline thinking</div>
                <div className="text-muted-foreground">Repeatable scripts that teams can reuse.</div>
              </div>
              <Separator />
              <div className="text-muted-foreground">
                Backend later: MongoDB will store completions, attempts, and streaks.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-12 flex flex-col items-start justify-between gap-2 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
          <div>BlenderCode — MVP for Blender automation learning</div>
          <div className="flex gap-3">
            <Link className="hover:underline" href="/dashboard">
              Dashboard
            </Link>
            <a className="hover:underline" href="#" aria-disabled>
              Docs (soon)
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}

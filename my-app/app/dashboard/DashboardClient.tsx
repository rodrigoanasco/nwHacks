"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";

type QuestionListItem = {
  name: string;
  difficulty: "easy" | "medium" | "hard" | string;
};

type ProgressQuestion = {
  name: string;
  attempts: number;
  passed: boolean;
};

type ProblemRow = {
  name: string;
  difficulty: string;
  completed: boolean;
  attempts: number;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DashboardClient({ userName }: { userName: string }) {
  const [rows, setRows] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [qRes, pRes] = await Promise.all([
          fetch("/api/question/all", { method: "GET" }),
          fetch("/api/progress", { method: "GET" }),
        ]);

        if (!qRes.ok) throw new Error(`question/all failed: ${qRes.status}`);
        if (!pRes.ok) throw new Error(`progress failed: ${pRes.status}`);

        const qJson: { questions: QuestionListItem[] } = await qRes.json();
        const pJson: { userId: string; questions: ProgressQuestion[] } =
          await pRes.json();

        const progressMap = new Map<string, ProgressQuestion>();
        for (const q of pJson.questions ?? []) {
          progressMap.set(q.name, q);
        }

        const merged: ProblemRow[] = (qJson.questions ?? []).map((q) => {
          const prog = progressMap.get(q.name);
          return {
            name: q.name,
            difficulty: q.difficulty ?? "unknown",
            completed: prog?.passed ?? false,
            attempts: prog?.attempts ?? 0,
          };
        });

        if (!cancelled) setRows(merged);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load dashboard data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const avatarFallback = useMemo(() => initials(userName), [userName]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Welcome</div>
            <div className="font-medium">{userName}</div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer" aria-label="Open user menu">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>{avatarFallback}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <LogoutLink>Sign out</LogoutLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <main className="pt-20 px-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-8 text-foreground">Problems</h1>

          {loading && <p>Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}

          {!loading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((problem) => (
                  <TableRow key={problem.name}>
                    <TableCell className="font-medium">{problem.name}</TableCell>

                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                          problem.difficulty === "easy"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : problem.difficulty === "medium"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            : problem.difficulty === "hard"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {problem.difficulty.charAt(0).toUpperCase() +
                          problem.difficulty.slice(1)}
                      </span>
                    </TableCell>

                    <TableCell>{problem.attempts}</TableCell>

                    <TableCell>
                      {problem.completed ? (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          ✓ Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          Incomplete
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}
